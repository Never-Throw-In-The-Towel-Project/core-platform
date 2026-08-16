import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCronRequest } from "@/lib/auth/cron";

/**
 * Publishes content scheduled for today or earlier — the engine behind the
 * distribution calendar's Month view. A draft (is_published = false) carrying a
 * scheduled_for date is flipped live once that date arrives.
 *
 * Idempotent: it only touches still-draft rows whose date has passed, so a
 * re-run (or an overlapping invocation) is a no-op. One-way: it never
 * unpublishes — pulling a live item stays a manual Studio action. Runs daily
 * (vercel.json), authenticated by the same CRON_SECRET bearer as every other
 * job. Uses the service role, so RLS doesn't hide rows from the sweep.
 */
export async function GET(request: NextRequest) {
  if (!(await verifyCronRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // A single global publish date in UTC. Content going live within a few hours
  // of local midnight is fine for a UK-first audience; no per-user timezone
  // reasoning is needed here (unlike the per-user reminder cron).
  const today = new Date().toISOString().slice(0, 10);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("content_items")
    // Clear scheduled_for as we publish: the date is a one-time "publish when it
    // arrives" instruction, now spent. Leaving it set would let a later manual
    // unpublish match this same query and silently re-publish the item.
    .update({ is_published: true, scheduled_for: null })
    .eq("is_published", false)
    .not("scheduled_for", "is", null)
    .lte("scheduled_for", today)
    .select("id");

  if (error) {
    console.error("[cron:publish-scheduled-content] update failed", error);
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  }

  const published = data?.length ?? 0;
  if (published > 0) {
    console.log(`[cron:publish-scheduled-content] published ${published} scheduled item(s) due on/before ${today}`);
  }
  return NextResponse.json({ ok: true, published });
}
