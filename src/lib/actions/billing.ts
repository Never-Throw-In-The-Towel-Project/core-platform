"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { getStripe } from "@/lib/stripe/client";
import { getOrCreateCustomer, getExistingCustomerId } from "@/lib/billing/checkout";
import { startAppTrial } from "@/lib/billing/trial";
import { proPriceId, type BillingInterval } from "@/lib/billing/plans";

/**
 * Billing server actions, wired to the Settings → Billing forms.
 *   - startTrial: grants the no-card app-level trial (no Stripe).
 *   - createCheckout: converts to paid via hosted Stripe Checkout.
 *   - openBillingPortal: Stripe Customer Portal for card/cancel/plan-switch.
 * Entitlement itself is granted by the webhook (lib/billing/sync.ts), never here.
 */

/** Start the 7-day no-card trial, then return to Settings showing Pro access. */
export async function startTrial(): Promise<void> {
  const profile = await getProfile();
  await startAppTrial({ userId: profile.id, companyId: profile.company_id, role: profile.role });
  revalidatePath("/home");
  revalidatePath("/settings");
  redirect("/settings?billing=trial");
}

/** Convert to paid: create a subscription Checkout Session and redirect to it. */
export async function createCheckout(formData: FormData): Promise<void> {
  const interval: BillingInterval = formData.get("interval") === "year" ? "year" : "month";
  const session = await verifySession();
  const priceId = proPriceId(interval);
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!priceId || !base) {
    redirect("/settings?billing=unavailable");
    return;
  }

  const customerId = await getOrCreateCustomer(session.userId, session.email ?? undefined);
  const checkout = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    // Both carry the user id so the webhook maps the resulting subscription back.
    client_reference_id: session.userId,
    subscription_data: { metadata: { user_id: session.userId } },
    success_url: new URL("/settings?billing=success", base).toString(),
    cancel_url: new URL("/settings?billing=cancelled", base).toString(),
  });

  if (checkout.url) {
    redirect(checkout.url);
  }
  redirect("/settings?billing=unavailable");
}

/** Open the Stripe Customer Portal (manage card / cancel / switch plan). */
export async function openBillingPortal(): Promise<void> {
  const session = await verifySession();
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  const customerId = await getExistingCustomerId(session.userId);
  if (!customerId || !base) {
    redirect("/settings?billing=unavailable");
    return;
  }

  const portal = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: new URL("/settings", base).toString(),
  });
  redirect(portal.url);
}
