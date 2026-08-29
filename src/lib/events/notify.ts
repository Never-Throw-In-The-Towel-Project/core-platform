import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isPushConfigured,
  sendPushToSubscription,
  type PushSubscriptionTarget,
  type PushPayload,
} from "@/lib/notifications/sendPush";
import { formatEventWhen } from "@/lib/events/format";
import {
  sendGuestEventCancelledEmail,
  sendGuestEventUpdatedEmail,
  sendGuestPromotedEmail,
} from "@/lib/events/guestEmail";

/** Public /events/<slug> URL, or undefined when the site URL isn't configured. */
function publicEventUrl(slug: string): string | undefined {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  return siteUrl ? `${siteUrl}/events/${slug}` : undefined;
}

/** Push to one member's devices, best-effort. */
async function pushToMember(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  payload: PushPayload
): Promise<void> {
  if (!isPushConfigured()) return;
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  const targets = (subs ?? []) as PushSubscriptionTarget[];
  await Promise.allSettled(targets.map((t) => sendPushToSubscription(t, payload)));
}

/**
 * Best-effort web-push to every MEMBER holding an active (confirmed or
 * waitlisted) booking on an event -- used when the event is cancelled or its
 * time/place changes, so booked members don't find out by chance (the events
 * flow made these silent, despite the copy promising otherwise).
 *
 * Service-role on purpose: it reads other users' bookings + push_subscriptions,
 * which RLS scopes to their owner. NEVER throws and NEVER blocks the save -- a
 * notification is a courtesy layered on top of an edit that already succeeded, so
 * a push hiccup must not surface as "couldn't cancel". Guests (no push, email
 * only) aren't covered here; that's a follow-up on the guest email path.
 */
export async function notifyEventBookers(eventId: string, payload: PushPayload): Promise<void> {
  // Cheap up-front bail if VAPID isn't set, so an unconfigured env does no work
  // and logs nothing per event (isPushConfigured logs once).
  if (!isPushConfigured()) return;
  try {
    const admin = createAdminClient();
    const { data: bookings } = await admin
      .from("event_bookings")
      .select("user_id")
      .eq("event_id", eventId)
      .in("status", ["confirmed", "waitlisted"])
      .not("user_id", "is", null);

    const userIds = Array.from(
      new Set(((bookings ?? []) as { user_id: string | null }[]).map((b) => b.user_id).filter(Boolean) as string[])
    );
    if (userIds.length === 0) return;

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", userIds);

    const targets = (subs ?? []) as PushSubscriptionTarget[];
    if (targets.length === 0) return;

    // Parallel + settled: one dead endpoint or slow push service must not hold up
    // the others, and none of them can reject out of here.
    await Promise.allSettled(targets.map((t) => sendPushToSubscription(t, payload)));
  } catch (error) {
    console.error("[notifyEventBookers] failed", error);
  }
}

/**
 * Tell whoever was just moved off the waitlist onto a confirmed seat -- a member
 * by push, a guest by email -- so the "we'll move you up the moment a spot frees"
 * promise is finally kept. Called by every path that promotes (member/guest/admin
 * cancel, admin promote, capacity reconcile) with the promoted booking id. Never
 * throws, never blocks the cancel/edit that triggered it.
 */
export async function notifyPromotedBooking(bookingId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("event_bookings")
      .select("user_id, guest_name, guest_email, event:events(title, slug, starts_at, ends_at)")
      .eq("id", bookingId)
      .maybeSingle();
    const b = data as {
      user_id: string | null;
      guest_name: string | null;
      guest_email: string | null;
      event?: { title: string; slug: string; starts_at: string; ends_at: string | null };
    } | null;
    if (!b || !b.event) return;

    if (b.user_id) {
      await pushToMember(admin, b.user_id, {
        title: "You’re off the waitlist",
        body: `A place opened up — you’re now booked in for “${b.event.title}”.`,
        url: `/events/${b.event.slug}`,
      });
    } else if (b.guest_email) {
      await sendGuestPromotedEmail({
        toEmail: b.guest_email,
        guestName: b.guest_name,
        eventTitle: b.event.title,
        eventWhen: formatEventWhen(b.event.starts_at, b.event.ends_at),
        eventUrl: publicEventUrl(b.event.slug),
      });
    }
  } catch (error) {
    console.error("[notifyPromotedBooking] failed", error);
  }
}

/**
 * Email every GUEST holding an active (confirmed or waitlisted) booking on an
 * event when it's cancelled or its time/place changes -- the guest counterpart of
 * notifyEventBookers (members get push), and matching its confirmed+waitlisted
 * reach so a waitlisted guest isn't left in the dark. Guests have no account, so
 * email is the only channel. Best-effort; never throws.
 */
export async function notifyEventGuests(
  eventId: string,
  kind: "cancelled" | "updated",
  what?: string
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: ev } = await admin
      .from("events")
      .select("title, slug, starts_at, ends_at")
      .eq("id", eventId)
      .maybeSingle();
    const event = ev as { title: string; slug: string; starts_at: string; ends_at: string | null } | null;
    if (!event) return;

    const { data: bookings } = await admin
      .from("event_bookings")
      .select("guest_name, guest_email")
      .eq("event_id", eventId)
      .in("status", ["confirmed", "waitlisted"])
      .is("user_id", null)
      .not("guest_email", "is", null);
    const guests = (bookings ?? []) as { guest_name: string | null; guest_email: string | null }[];
    if (guests.length === 0) return;

    const when = formatEventWhen(event.starts_at, event.ends_at);
    const eventUrl = publicEventUrl(event.slug);
    await Promise.allSettled(
      guests.map((g) => {
        if (!g.guest_email) return Promise.resolve({ ok: false });
        const base = { toEmail: g.guest_email, guestName: g.guest_name, eventTitle: event.title, eventWhen: when, eventUrl };
        return kind === "cancelled"
          ? sendGuestEventCancelledEmail(base)
          : sendGuestEventUpdatedEmail({ ...base, what: what ?? "details" });
      })
    );
  } catch (error) {
    console.error("[notifyEventGuests] failed", error);
  }
}
