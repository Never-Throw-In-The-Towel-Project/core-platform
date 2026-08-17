import { NextRequest, NextResponse } from "next/server";

// LEGACY: this route used to confirm a guest booking directly on GET, which let
// email link-scanners auto-confirm (and, via the cancel route, auto-cancel)
// bookings. It now just REDIRECTS to the click-to-confirm landing page, where a
// human has to press a button (a server-action POST) to actually confirm. Kept
// so any already-sent emails pointing here still work, safely.
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  const dest = new URL("/events/confirm", site);
  const booking = req.nextUrl.searchParams.get("booking");
  const token = req.nextUrl.searchParams.get("token");
  if (booking) dest.searchParams.set("booking", booking);
  if (token) dest.searchParams.set("token", token);
  return NextResponse.redirect(dest);
}
