/**
 * B2C subscription catalogue (Phase 1) — the single source of truth for tiers,
 * pricing and trial length, read by Checkout, the upgrade page and the
 * entitlement layer. Pure config (no Stripe calls), so it's importable anywhere
 * and unit-testable. The authoritative *charge* is whatever the Stripe Price
 * says; the pence amounts here are for display + a sanity assertion.
 *
 * See docs/SUBSCRIPTIONS_PLAN.md. Two tiers: Freemium (Get Support + Events +
 * own read-only data) and Pro (full access). A 7-day no-card app-level trial of
 * Pro precedes any charge; a card is collected only at conversion via Checkout.
 */
export type PlanTier = "freemium" | "pro";
export type BillingInterval = "month" | "year";

/** No-card app-level trial length (days). */
export const TRIAL_DAYS = 7;

/** ISO 4217 currency for all Pro charges. */
export const CURRENCY = "gbp";

/** Annual is this percent cheaper than paying monthly for a year. */
export const ANNUAL_DISCOUNT_PCT = 10;

/** Pro pricing in pence (display + sanity). £27.00/mo; annual = 10% off 12×monthly. */
export const PRO_MONTHLY_PENCE = 2700; // £27.00
export const PRO_ANNUAL_PENCE = 29160; // £291.60 = round(2700 × 12 × 0.9)

/** The headline annual saving vs paying monthly for a year, in pence. */
export function annualSavingPence(): number {
  return PRO_MONTHLY_PENCE * 12 - PRO_ANNUAL_PENCE;
}

/**
 * The Stripe Price ID for Pro at the given interval, from env (created in the
 * Stripe dashboard — test-mode IDs on Preview, live-mode in Production). Null
 * when unset, so a not-yet-configured deploy degrades to "billing unavailable"
 * rather than crashing a checkout action.
 */
export function proPriceId(interval: BillingInterval): string | null {
  const raw = interval === "year" ? process.env.STRIPE_PRICE_PRO_ANNUAL : process.env.STRIPE_PRICE_PRO_MONTHLY;
  return raw && raw.trim() ? raw.trim() : null;
}
