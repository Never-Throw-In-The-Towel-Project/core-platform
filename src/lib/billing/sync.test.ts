import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

vi.mock("server-only", () => ({}));

// Mock the service-role admin client: record upserts, control the fallback lookup.
const upsert = vi.fn((): Promise<{ error: { message: string } | null }> => Promise.resolve({ error: null }));
const maybeSingle = vi.fn(
  (): Promise<{ data: { user_id: string } | null }> => Promise.resolve({ data: null })
);
const fromMock = vi.fn(() => ({
  upsert,
  select: () => ({ eq: () => ({ maybeSingle }) }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

const { mapSubscriptionToRow, resolveUserIdFromObjects, syncSubscriptionFromStripe } = await import("./sync");

// A minimal Stripe.Subscription shaped for the fields the mapping reads.
function fakeSub(overrides: Record<string, unknown> = {}): Stripe.Subscription {
  return {
    id: "sub_123",
    status: "active",
    customer: "cus_123",
    cancel_at_period_end: false,
    trial_end: null,
    metadata: {},
    items: { data: [{ current_period_end: 1_800_000_000, price: { id: "price_m" } }] },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("mapSubscriptionToRow", () => {
  it("maps a Stripe subscription to a row, reading current_period_end from the ITEM", () => {
    const row = mapSubscriptionToRow(fakeSub({ cancel_at_period_end: true, trial_end: 1_700_000_000 }), "user-1");
    expect(row).toMatchObject({
      user_id: "user-1",
      source: "stripe",
      status: "active",
      tier: "pro",
      price_id: "price_m",
      stripe_subscription_id: "sub_123",
      cancel_at_period_end: true,
    });
    expect(row.current_period_end).toBe(new Date(1_800_000_000 * 1000).toISOString());
    expect(row.trial_end).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });

  it("tolerates a subscription with no items / no period end", () => {
    const row = mapSubscriptionToRow(fakeSub({ items: { data: [] } }), "user-1");
    expect(row.price_id).toBeNull();
    expect(row.current_period_end).toBeNull();
  });
});

describe("resolveUserIdFromObjects", () => {
  it("prefers subscription metadata, then session metadata, then client_reference_id", () => {
    expect(resolveUserIdFromObjects(fakeSub({ metadata: { user_id: "u-sub" } }))).toBe("u-sub");
    expect(
      resolveUserIdFromObjects(fakeSub(), { metadata: { user_id: "u-sess" } } as unknown as Stripe.Checkout.Session)
    ).toBe("u-sess");
    expect(
      resolveUserIdFromObjects(fakeSub(), {
        metadata: {},
        client_reference_id: "u-ref",
      } as unknown as Stripe.Checkout.Session)
    ).toBe("u-ref");
    expect(resolveUserIdFromObjects(fakeSub())).toBeNull();
  });
});

describe("syncSubscriptionFromStripe", () => {
  it("upserts billing_customers + subscriptions when the user resolves from metadata", async () => {
    const res = await syncSubscriptionFromStripe(fakeSub({ metadata: { user_id: "user-1" } }));
    expect(res.ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith("billing_customers");
    expect(fromMock).toHaveBeenCalledWith("subscriptions");
    expect(upsert).toHaveBeenCalledTimes(2);
    // Never looked up the mapping — metadata resolved it.
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it("falls back to the billing_customers mapping when metadata is absent", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { user_id: "mapped-user" } });
    const res = await syncSubscriptionFromStripe(fakeSub());
    expect(res.ok).toBe(true);
    expect(maybeSingle).toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it("returns ok:false and logs (no upsert) when the user cannot be resolved", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null });
    const res = await syncSubscriptionFromStripe(fakeSub({ customer: "cus_unknown" }));
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("no_user");
    expect(console.error).toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("throws (→ webhook 500 → Stripe retry) when the DB upsert fails", async () => {
    upsert.mockResolvedValueOnce({ error: { message: "db down" } });
    await expect(syncSubscriptionFromStripe(fakeSub({ metadata: { user_id: "user-1" } }))).rejects.toThrow(/db down/);
  });
});
