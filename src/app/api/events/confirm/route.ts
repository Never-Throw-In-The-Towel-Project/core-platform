import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyBookingToken } from "@/lib/events/guestToken";

// The tokenised link from the guest double opt-in email. Unauthenticated (a
// guest has no session) -- /api/* is excluded from the proxy, and the HMAC token
// is the authorisation. Verifies the token, claims the seat via the service-role
// confirm_guest_booking() function, and redirects back to the event with a
// banner flag. GET so it's clickable straight from an inbox.
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

    const { data, error } = await admin.rpc("confirm_guest_booking", { p_booking_id: bookingId });
    if (error) return go(`${base}?guest=error`);
    const status = String(data); // 'confirmed' | 'waitlisted'
    return go(`${base}?guest=${status}`);
  } catch {
    return go("/events?guest=error");
  }
}
