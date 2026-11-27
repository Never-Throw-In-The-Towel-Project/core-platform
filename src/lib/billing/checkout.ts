import "server-only";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe Customer mapping helpers for the checkout flow. One Stripe Customer per
 * user, recorded in billing_customers (service-role) so every later webhook event
 * resolves back to the user. Hosted Checkout + the Billing Portal are both
 * server-created redirects, so no publishable key / Stripe.js is involved.
 */

/** The user's existing Stripe customer id, or null — never creates one. */
export async function getExistingCustomerId(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.stripe_customer_id as string | null | undefined) ?? null;
}

/** Get the user's Stripe customer id, creating + persisting one if absent. The
 *  customer carries metadata.user_id so webhook events map back without a lookup. */
export async function getOrCreateCustomer(userId: string, email: string | undefined): Promise<string> {
  const existing = await getExistingCustomerId(userId);
  if (existing) return existing;

  const customer = await getStripe().customers.create({
    email: email || undefined,
    metadata: { user_id: userId },
  });

  const admin = createAdminClient();
  await admin
    .from("billing_customers")
    .upsert(
      { user_id: userId, stripe_customer_id: customer.id, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  return customer.id;
}
