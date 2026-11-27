import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { syncSubscriptionFromStripe } from "@/lib/billing/sync";

// Stripe signature verification needs the RAW body + node:crypto, so the Node
// runtime (not Edge) and no caching. Same constraints as /api/auth/send-email.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook — the authoritative sync of subscription state into our DB.
 *
 * Every event is HMAC-verified against STRIPE_WEBHOOK_SECRET before we act (a
 * forged/replayed call is rejected). Entitlement is granted ONLY here, never from
 * the Checkout success redirect. Handlers upsert by user_id, so a Stripe retry is
 * idempotent. Register the endpoint in the Stripe dashboard
 * (…/api/stripe/webhook) to obtain STRIPE_WEBHOOK_SECRET. See
 * docs/SUBSCRIPTIONS_PLAN.md.
 */
const HANDLED = new Set<string>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: { message: "not configured" } }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: { message: "missing signature" } }, { status: 400 });
  }

  // RAW body — constructEvent verifies the signature over the exact bytes.
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch {
    // Verification failed: not from Stripe, or STRIPE_WEBHOOK_SECRET doesn't match
    // the endpoint's secret in the Stripe dashboard. Logged so that's visible.
    console.warn("[stripe/webhook] signature verification failed — check STRIPE_WEBHOOK_SECRET matches the Stripe endpoint");
    return NextResponse.json({ error: { message: "invalid signature" } }, { status: 400 });
  }

  if (!HANDLED.has(event.type)) {
    // ACK events we don't act on (Stripe sends many) so they aren't retried.
    return NextResponse.json({ received: true, ignored: event.type }, { status: 200 });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    // A thrown error (e.g. a transient DB failure) returns 500 so Stripe retries;
    // the upserts are idempotent, so the retry re-applies the same state safely.
    console.error("[stripe/webhook] handler failed", { type: event.type, cause: String(err) });
    return NextResponse.json({ error: { message: "handler error" } }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      // Only subscription-mode checkouts concern us; the session carries the
      // subscription id, so retrieve the full subscription to sync from.
      if (session.mode !== "subscription" || !session.subscription) return;
      const subId =
        typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      const sub = await getStripe().subscriptions.retrieve(subId);
      await syncSubscriptionFromStripe(sub, session);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      // The event carries the full subscription object (status reflects the
      // change — e.g. 'past_due' on a failed renewal, 'canceled' on delete).
      const sub = event.data.object as Stripe.Subscription;
      await syncSubscriptionFromStripe(sub);
      return;
    }
  }
}
