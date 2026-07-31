"use server";

import { createClient } from "@/lib/supabase/server";
import { verifySession } from "@/lib/auth/dal";

type SubscriptionPayload = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/**
 * `endpoint` is globally unique per browser subscription (not scoped to a
 * user) -- see the Phase 9 migration. Upserting on it means a browser that
 * re-subscribes (or a shared device where a different user is now signed
 * in) just updates ownership of the same row rather than erroring or
 * accumulating duplicates.
 */
export async function subscribeToPush(payload: SubscriptionPayload): Promise<{ ok: boolean }> {
  const session = await verifySession();
  const supabase = await createClient();

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: session.userId,
      endpoint: payload.endpoint,
      p256dh: payload.keys.p256dh,
      auth: payload.keys.auth,
    },
    { onConflict: "endpoint" }
  );

  return { ok: !error };
}

export async function unsubscribeFromPush(endpoint: string): Promise<{ ok: boolean }> {
  const session = await verifySession();
  const supabase = await createClient();

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", session.userId)
    .eq("endpoint", endpoint);

  return { ok: !error };
}

/** Whether the current user has any active push subscription, for /settings to render the right toggle state. */
export async function getPushSubscriptionStatus(): Promise<boolean> {
  const session = await verifySession();
  const supabase = await createClient();

  const { count } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.userId);

  return (count ?? 0) > 0;
}
