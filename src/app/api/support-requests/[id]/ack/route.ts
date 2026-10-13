import { NextResponse, type NextRequest } from "next/server";

// LEGACY: this route used to mark an Ask-for-Support request "contacted"
// directly on GET, which let email/SMS link-scanners and mail-client
// prefetchers auto-acknowledge a real cry for help -- silently cancelling the
// escalation in monitor-support-response-time (finding E5). It now just
// REDIRECTS to the click-to-confirm landing page, where the first-aider has to
// press a button (a server-action POST, acknowledgeSupportRequest) to actually
// mark it contacted. Kept so any already-sent alert links pointing here still
// work, safely. Same fix the event-booking confirm/cancel routes already got.
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
  const dest = new URL("/support/ack", site);
  dest.searchParams.set("request", id);
  const token = request.nextUrl.searchParams.get("token");
  if (token) dest.searchParams.set("token", token);
  return NextResponse.redirect(dest);
}
