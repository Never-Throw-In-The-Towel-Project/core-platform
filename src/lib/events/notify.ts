import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isPushConfigured,
  sendPushToSubscription,
  type PushSubscriptionTarget,
  type PushPayload,
} from "@/lib/notifications/sendPush";

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
