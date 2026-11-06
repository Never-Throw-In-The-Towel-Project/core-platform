import { NextResponse, type NextRequest } from "next/server";

/**
 * CSP violation sink (E15).
 *
 * The Report-Only Content-Security-Policy points its `report-uri` here (see
 * src/lib/security/headers.ts). Browsers POST a JSON report describing what the
 * policy WOULD have blocked; we log it so we can confirm the policy is clean
 * against real traffic before a follow-up flips CSP to enforcing.
 *
 * - We only LOG — nothing is stored.
 * - The body is size-capped so an anonymous POST can't be used to flood.
 * - Unauthenticated by design: reports come from browsers with no session, and
 *   this route lives under /api/*, which the proxy excludes from the auth gate.
 */
export const dynamic = "force-dynamic";

// A CSP report is ~1 KB; cap generously but firmly.
const MAX_BYTES = 16 * 1024;

export async function POST(request: NextRequest) {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  try {
    const raw = await request.text();
    if (raw.length > MAX_BYTES) {
      return new NextResponse(null, { status: 413 });
    }

    let report: unknown = raw;
    try {
      report = JSON.parse(raw);
    } catch {
      // Not JSON — keep the raw text so the log still captures something useful.
    }

    // One structured line per violation — surfaces in the function logs.
    console.warn("[csp-report]", JSON.stringify(report));
  } catch {
    // A telemetry sink must never throw back at the browser.
  }

  return new NextResponse(null, { status: 204 });
}
