import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const bcMaybeSingle = vi.fn((): Promise<{ data: { trial_started_at: string | null } | null }> =>
  Promise.resolve({ data: null })
);
const subMaybeSingle = vi.fn((): Promise<{ data: { source: string; status: string } | null }> =>
  Promise.resolve({ data: null })
);
const upsert = vi.fn((): Promise<{ error: { message: string } | null }> => Promise.resolve({ error: null }));

const fromMock = vi.fn((table: string) => ({
  select: () => ({ eq: () => ({ maybeSingle: table === "billing_customers" ? bcMaybeSingle : subMaybeSingle }) }),
  upsert,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: fromMock }) }));

const { DIRECT_COMPANY_ID } = await import("@/lib/tenant/constants");
const { startAppTrial } = await import("./trial");

const direct = { userId: "u1", companyId: DIRECT_COMPANY_ID, role: "employee" };

beforeEach(() => {
  vi.clearAllMocks();
  bcMaybeSingle.mockResolvedValue({ data: null });
  subMaybeSingle.mockResolvedValue({ data: null });
  upsert.mockResolvedValue({ error: null });
});

describe("startAppTrial", () => {
  it("refuses a non-Direct member (partner employee) — they already have full access", async () => {
    const res = await startAppTrial({ userId: "u1", companyId: "partner-co", role: "employee" });
    expect(res).toEqual({ ok: false, reason: "not_eligible" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses a non-employee role (e.g. ntitt_admin)", async () => {
    const res = await startAppTrial({ userId: "u1", companyId: DIRECT_COMPANY_ID, role: "ntitt_admin" });
    expect(res).toEqual({ ok: false, reason: "not_eligible" });
  });

  it("refuses a second trial once trial_started_at is set (one-trial guard)", async () => {
    bcMaybeSingle.mockResolvedValue({ data: { trial_started_at: "2026-01-01T00:00:00Z" } });
    const res = await startAppTrial(direct);
    expect(res).toEqual({ ok: false, reason: "already_used" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses when the user already has a Stripe subscription", async () => {
    subMaybeSingle.mockResolvedValue({ data: { source: "stripe", status: "active" } });
    const res = await startAppTrial(direct);
    expect(res).toEqual({ ok: false, reason: "already_subscribed" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("grants a fresh trial: sets trial_started_at + writes a trialing subscription row", async () => {
    const res = await startAppTrial(direct);
    expect(res).toEqual({ ok: true });
    expect(fromMock).toHaveBeenCalledWith("billing_customers");
    expect(fromMock).toHaveBeenCalledWith("subscriptions");
    expect(upsert).toHaveBeenCalledTimes(2);
    // First upsert = billing_customers (trial_started_at), second = subscriptions.
    const subRow = (upsert.mock.calls as unknown[][])[1][0] as Record<string, unknown>;
    expect(subRow).toMatchObject({ user_id: "u1", source: "app_trial", status: "trialing", tier: "pro" });
    expect(typeof subRow.trial_end).toBe("string");
  });

  it("returns error (no throw) when a DB write fails", async () => {
    upsert.mockResolvedValueOnce({ error: { message: "db down" } });
    const res = await startAppTrial(direct);
    expect(res).toEqual({ ok: false, reason: "error" });
  });
});
