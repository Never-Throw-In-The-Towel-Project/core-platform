import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyBookingToken } from "@/lib/events/guestToken";

// The "cancel" tokenised link from the guest booking email (also the "this
// wasn't me" escape hatch). Same auth model as the confirm route: HMAC token,
// no session. Cancels via cancel_guest_booking() (which also promotes the next
// waitlister) and redirects back with a banner flag.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  const bookingId = req.nextUrl.searchParams.get("booking") ?? "";
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const go = (path: string) => NextResponse.redirect(new URL(path, site));

  if (!bookingId || !token || !(await verifyBookingToken(bookingId, token))) {
    return go("/events?guest=error");
  }

  try {
    const admin = createAdminClient();
    const { data: bk } = await admin
      .from("event_bookings")
      .select("event:events(slug)")
      .eq("id", bookingId)
      .maybeSingle();
    const slug = (bk as { event?: { slug?: string } } | null)?.event?.slug ?? null;
    const base = slug ? `/events/${slug}` : "/events";

    const { error } = await admin.rpc("cancel_guest_booking", { p_booking_id: bookingId });
    if (error) return go(`${base}?guest=error`);
    return go(`${base}?guest=cancelled`);
  } catch {
    return go("/events?guest=error");
  }
}
