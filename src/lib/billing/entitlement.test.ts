import { describe, it, expect, vi } from "vitest";

// entitlement.ts is server-only and pulls the DAL + supabase server client at
// import; mock them so we can unit-test the pure resolver in isolation.
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ getProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { resolveEntitlement } = await import("./entitlement");
const { DIRECT_COMPANY_ID } = await import("@/lib/tenant/constants");

const future = new Date(Date.now() + 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();
const direct = { role: "employee" as const, company_id: DIRECT_COMPANY_ID };

describe("resolveEntitlement", () => {
  it("staff (ntitt_admin) are always full", () => {
    expect(resolveEntitlement({ role: "ntitt_admin", company_id: DIRECT_COMPANY_ID }, null)).toBe("full");
  });

  it("partner-company members are always full — the partner-safety rule (never paywalled)", () => {
    expect(resolveEntitlement({ role: "employee", company_id: "partner-co" }, null)).toBe("full");
    expect(resolveEntitlement({ role: "hr_admin", company_id: "partner-co" }, null)).toBe("full");
  });

  it("a Direct member with no subscription is freemium", () => {
    expect(resolveEntitlement(direct, null)).toBe("freemium");
  });

  it("Direct member: active → full", () => {
    expect(resolveEntitlement(direct, { status: "active", trial_end: null, current_period_end: null })).toBe("full");
  });

  it("Direct member: trialing is full while trial_end is in the future, freemium once expired", () => {
    expect(resolveEntitlement(direct, { status: "trialing", trial_end: future, current_period_end: null })).toBe("full");
    expect(resolveEntitlement(direct, { status: "trialing", trial_end: past, current_period_end: null })).toBe(
      "freemium"
    );
  });

  it("Direct member: cancelled keeps access until current_period_end, then freemium", () => {
    expect(resolveEntitlement(direct, { status: "canceled", trial_end: null, current_period_end: future })).toBe(
      "full"
    );
    expect(resolveEntitlement(direct, { status: "canceled", trial_end: null, current_period_end: past })).toBe(
      "freemium"
    );
  });

  it("Direct member: past_due → freemium", () => {
    expect(resolveEntitlement(direct, { status: "past_due", trial_end: null, current_period_end: null })).toBe(
      "freemium"
    );
  });
});
