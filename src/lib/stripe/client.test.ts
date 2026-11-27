import { describe, it, expect, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { isStripeConfigured, getStripe } = await import("./client");

describe("stripe client", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("isStripeConfigured reflects whether the secret key is present", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(isStripeConfigured()).toBe(false);
    vi.stubEnv("STRIPE_SECRET_KEY", "   ");
    expect(isStripeConfigured()).toBe(false);
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    expect(isStripeConfigured()).toBe(true);
  });

  it("getStripe throws a clear, non-leaky error when the key is unset", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(() => getStripe()).toThrow(/STRIPE_SECRET_KEY/);
  });
});
