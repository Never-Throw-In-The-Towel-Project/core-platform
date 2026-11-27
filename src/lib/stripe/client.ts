import "server-only";
import Stripe from "stripe";

/**
 * The ONE Stripe server client (secret-key, server-only) — same single-module
 * discipline as src/lib/email/brevo.ts is for Brevo. Lazy singleton so importing
 * this module NEVER throws at load time when STRIPE_SECRET_KEY is absent (CI, a
 * preview without the key, or the module pulled in transitively). It only throws
 * when actually used without a key, which callers handle (and the entitlement
 * layer treats "not configured" as "no subscription" → Freemium).
 *
 * `apiVersion` is pinned to the value this SDK (stripe@23) ships with, so a Stripe
 * SDK/API upgrade is a deliberate, reviewed change rather than a silent drift.
 */
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !key.trim()) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  cached = new Stripe(key, { apiVersion: "2026-11-18.endive" });
  return cached;
}

/** Whether Stripe is configured (secret key present) — lets callers degrade
 *  gracefully instead of throwing when billing isn't wired up on a deploy. */
export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  return typeof key === "string" && key.trim().length > 0;
}
