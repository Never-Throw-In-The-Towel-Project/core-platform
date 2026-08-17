import { NextRequest, NextResponse } from "next/server";

// LEGACY: this route used to cancel a guest booking directly on GET (see the
// confirm route). It now just REDIRECTS to the click-to-cancel landing page,
// where a human confirms via a button (server-action POST), so an email
// link-scanner can't drop a booking. Kept for already-sent emails.
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  const dest = new URL("/events/cancel", site);
  const booking = req.nextUrl.searchParams.get("booking");
  const token = req.nextUrl.searchParams.get("token");
  if (booking) dest.searchParams.set("booking", booking);
  if (token) dest.searchParams.set("token", token);
  return NextResponse.redirect(dest);
}
