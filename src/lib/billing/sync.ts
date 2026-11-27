import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe → our DB subscription-state sync. The webhook (src/app/api/stripe/
 * webhook) is the ONLY caller; writes go through the service-role admin client
 * (RLS bypass) because `subscriptions` / `billing_customers` are member-read-only.
 *
 * The mapping functions are pure + unit-tested. Note the API-version detail: in
 * Stripe API 2026-11-18 `current_period_end` lives on the subscription ITEM, not
 * the subscription, so we read it from items.data[0].
 */

/** Resolve our internal user id. Prefer the metadata we attach at Checkout (on
 *  both the subscription and the session), then the session's client_reference_id. */
export function resolveUserIdFromObjects(
  sub: Stripe.Subscription | null,
  session?: Stripe.Checkout.Session | null
): string | null {
  const fromSub = sub?.metadata?.user_id;
  if (fromSub) return fromSub;
  const fromSessionMeta = session?.metadata?.user_id;
  if (fromSessionMeta) return fromSessionMeta;
  const ref = session?.client_reference_id;
  if (ref) return ref;
  return null;
}

function stripeCustomerId(sub: Stripe.Subscription): string | null {
  const c = sub.customer;
  if (!c) return null;
  return typeof c === "string" ? c : c.id;
}

/** Map a Stripe Subscription to our `subscriptions` row. Pure + testable. */
export function mapSubscriptionToRow(sub: Stripe.Subscription, userId: string) {
  const item = sub.items?.data?.[0];
  // current_period_end is on the ITEM in this API version (not the subscription).
  const periodEnd = item?.current_period_end ?? null;
  return {
    user_id: userId,
    source: "stripe" as const,
    status: sub.status as string,
    tier: "pro" as const,
    price_id: item?.price?.id ?? null,
    stripe_subscription_id: sub.id,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Upsert the authoritative subscription state for a Stripe subscription. Keeps
 * the customer→user mapping current (preserving trial_started_at) and upserts the
 * single per-user `subscriptions` row. Idempotent (upsert by user_id), so a Stripe
 * retry is safe. Returns ok:false (without throwing) when the subscription can't
 * be mapped to a user, so the webhook ACKs rather than looping forever.
 */
export async function syncSubscriptionFromStripe(
  sub: Stripe.Subscription,
  session?: Stripe.Checkout.Session | null
): Promise<{ ok: boolean; reason?: string }> {
  const admin = createAdminClient();
  const cust = stripeCustomerId(sub);

  let userId = resolveUserIdFromObjects(sub, session);
  if (!userId && cust) {
    const { data } = await admin
      .from("billing_customers")
      .select("user_id")
      .eq("stripe_customer_id", cust)
      .maybeSingle();
    userId = (data?.user_id as string | undefined) ?? null;
  }
  if (!userId) {
    // PII-free log (ids only); ACK so Stripe stops retrying an unmappable event.
    console.error("[stripe/sync] could not resolve user_id", { subscription: sub.id, customer: cust });
    return { ok: false, reason: "no_user" };
  }

  if (cust) {
    // Upsert ONLY the columns we own here so trial_started_at is preserved.
    const { error } = await admin
      .from("billing_customers")
      .upsert(
        { user_id: userId, stripe_customer_id: cust, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    if (error) throw new Error(`billing_customers upsert failed: ${error.message}`);
  }

  const { error } = await admin
    .from("subscriptions")
    .upsert(mapSubscriptionToRow(sub, userId), { onConflict: "user_id" });
  if (error) throw new Error(`subscriptions upsert failed: ${error.message}`);

  return { ok: true };
}
