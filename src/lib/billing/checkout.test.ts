import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const maybeSingle = vi.fn((): Promise<{ data: { stripe_customer_id: string | null } | null }> =>
  Promise.resolve({ data: null })
);
const upsert = vi.fn(() => Promise.resolve({ error: null }));
const fromMock = vi.fn(() => ({
  select: () => ({ eq: () => ({ maybeSingle }) }),
  upsert,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: fromMock }) }));

const customersCreate = vi.fn((): Promise<{ id: string }> => Promise.resolve({ id: "cus_new" }));
vi.mock("@/lib/stripe/client", () => ({ getStripe: () => ({ customers: { create: customersCreate } }) }));

const { getOrCreateCustomer, getExistingCustomerId } = await import("./checkout");

beforeEach(() => {
  vi.clearAllMocks();
  maybeSingle.mockResolvedValue({ data: null });
});

describe("getExistingCustomerId", () => {
  it("returns the stored id, or null when absent", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { stripe_customer_id: "cus_abc" } });
    expect(await getExistingCustomerId("u1")).toBe("cus_abc");
    maybeSingle.mockResolvedValueOnce({ data: null });
    expect(await getExistingCustomerId("u1")).toBeNull();
  });
});

describe("getOrCreateCustomer", () => {
  it("reuses an existing customer without calling Stripe", async () => {
    maybeSingle.mockResolvedValue({ data: { stripe_customer_id: "cus_existing" } });
    const id = await getOrCreateCustomer("u1", "a@b.test");
    expect(id).toBe("cus_existing");
    expect(customersCreate).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("creates a Stripe customer (with user_id metadata) and persists the mapping when none exists", async () => {
    maybeSingle.mockResolvedValue({ data: null });
    const id = await getOrCreateCustomer("u1", "a@b.test");
    expect(id).toBe("cus_new");
    expect(customersCreate).toHaveBeenCalledWith(expect.objectContaining({ metadata: { user_id: "u1" } }));
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", stripe_customer_id: "cus_new" }),
      { onConflict: "user_id" }
    );
  });
});
