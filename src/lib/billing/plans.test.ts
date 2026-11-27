import { describe, it, expect, afterEach, vi } from "vitest";
import {
  PRO_MONTHLY_PENCE,
  PRO_ANNUAL_PENCE,
  ANNUAL_DISCOUNT_PCT,
  TRIAL_DAYS,
  annualSavingPence,
  proPriceId,
} from "./plans";

describe("billing plans config", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("prices Pro at £27/mo and the annual at a 10% discount on 12× monthly", () => {
    expect(PRO_MONTHLY_PENCE).toBe(2700);
    expect(PRO_ANNUAL_PENCE).toBe(Math.round(PRO_MONTHLY_PENCE * 12 * (1 - ANNUAL_DISCOUNT_PCT / 100)));
    expect(PRO_ANNUAL_PENCE).toBe(29160); // £291.60
  });

  it("reports the annual saving vs paying monthly for a year", () => {
    expect(annualSavingPence()).toBe(PRO_MONTHLY_PENCE * 12 - PRO_ANNUAL_PENCE);
    expect(annualSavingPence()).toBe(3240); // £32.40
  });

  it("runs a 7-day trial", () => {
    expect(TRIAL_DAYS).toBe(7);
  });

  it("reads the Pro Price IDs from env (trimmed), null when unset", () => {
    vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "  price_month  ");
    vi.stubEnv("STRIPE_PRICE_PRO_ANNUAL", "");
    expect(proPriceId("month")).toBe("price_month");
    expect(proPriceId("year")).toBeNull();
  });
});
