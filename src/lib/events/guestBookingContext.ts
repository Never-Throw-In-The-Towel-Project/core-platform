import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatEventWhen } from "@/lib/events/format";

export type GuestBookingContext = {
  slug: string | null;
  title: string;
  when: string;
};

/**
 * Load an event's public display fields for a guest booking id, for the
 * click-to-confirm landing pages. Read via the service-role client (a guest has
 * no session, and event_bookings isn't anon-readable). The caller has already
 * verified the HMAC token, so this only turns a valid booking id into something
 * to show; returns null if the booking/event can't be resolved.
 */
export async function loadGuestBookingContext(bookingId: string): Promise<GuestBookingContext | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("event_bookings")
      .select("event:events(slug, title, starts_at, ends_at)")
      .eq("id", bookingId)
      .maybeSingle();
    const event = (data as { event?: { slug?: string; title?: string; starts_at?: string; ends_at?: string | null } } | null)
      ?.event;
    if (!event?.starts_at) return null;
    return {
      slug: event.slug ?? null,
      title: event.title ?? "the event",
      when: formatEventWhen(event.starts_at, event.ends_at ?? null),
    };
  } catch {
    return null;
  }
}
