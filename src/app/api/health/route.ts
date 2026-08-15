import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyCronRequest } from "@/lib/auth/cron";
import { summarizeConfig } from "@/lib/health/config";

/**
 * Readiness probe for uptime monitoring and operator go-live checks.
 *
 * Two modes, one endpoint:
 *
 * - **Public (default):** liveness + a cheap database round-trip. Returns 200
 *   `{ status: "ok", database: "ok" }` when the app can reach Postgres, else
 *   503 `{ status: "unhealthy", database: "error" }`. Exposes nothing else, so
 *   an external monitor can alert on hard downtime without leaking config.
 * - **Detail (authenticated):** adds a config-readiness report (which critical
 *   env groups are set — names of missing vars, never values). Gated behind the
 *   SAME constant-time bearer as the cron jobs (`CRON_SECRET`), because config
 *   posture is sensitive. Triggered by `?detail=1` or an `Authorization` header;
 *   a detail request without a valid bearer gets 401.
 *
 * force-dynamic so it is never statically cached; Node runtime (default) so the
 * Supabase client and node:crypto in the cron-auth helper work.
 */
export const dynamic = "force-dynamic";

async function isDatabaseReachable(): Promise<boolean> {
  try {
    // createClient() throws synchronously if the Supabase URL/key are missing or
    // malformed; a Route Handler isn't covered by app/error.tsx, so catch it and
    // report unhealthy rather than 500 with a stack. A HEAD count round-trips to
    // Postgres without returning rows; RLS returning zero rows is not an error,
    // so a null error means "the database answered" = reachable.
    const supabase = await createClient();
    const { error } = await supabase.from("companies").select("id", { head: true, count: "exact" });
    return !error;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const dbReachable = await isDatabaseReachable();
  const status = dbReachable ? "ok" : "unhealthy";
  const httpStatus = dbReachable ? 200 : 503;
  const time = new Date().toISOString();
  const base = { status, database: dbReachable ? "ok" : "error", time };

  const wantsDetail =
    new URL(request.url).searchParams.get("detail") === "1" || request.headers.has("authorization");

  if (wantsDetail) {
    if (!(await verifyCronRequest(request))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ ...base, config: summarizeConfig(process.env) }, { status: httpStatus });
  }

  return NextResponse.json(base, { status: httpStatus });
}
