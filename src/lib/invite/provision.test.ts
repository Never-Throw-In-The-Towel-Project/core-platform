import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const inviteUserByEmail = vi.fn();
const deleteUser = vi.fn(() => Promise.resolve({ error: null }));
const maybeSingle = vi.fn();
const upsert = vi.fn();
const fromMock = vi.fn(() => ({
  // provision.ts pre-checks with .select(...).eq("id", ...).maybeSingle() and
  // then writes with .upsert(...). Both go through the same from("profiles").
  select: () => ({ eq: () => ({ maybeSingle }) }),
  upsert,
}));
const createAdminClientMock = vi.fn(() => ({
  auth: { admin: { inviteUserByEmail, deleteUser } },
  from: fromMock,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClientMock(),
}));

const { provisionInvite } = await import("./provision");
const { DIRECT_COMPANY_ID } = await import("@/lib/tenant/constants");

const params = {
  email: "invitee@acme.test",
  displayName: "Alex Admin",
  companyId: "company-acme",
  role: "hr_admin" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.neverthrowinthetowel.uk");
  inviteUserByEmail.mockResolvedValue({ data: { user: { id: "invitee-id" } }, error: null });
  // Default: the handle_new_user trigger's untouched default row for a genuinely
  // new invite.
  maybeSingle.mockResolvedValue({
    data: { role: "employee", company_id: DIRECT_COMPANY_ID, onboarding_completed: false, tc_agreed_at: null },
  });
  upsert.mockResolvedValue({ error: null });
  deleteUser.mockResolvedValue({ error: null });
});

describe("provisionInvite", () => {
  it("provisions a genuinely new invite (untouched trigger-default row)", async () => {
    const res = await provisionInvite(params);

    expect(res).toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "invitee-id",
        company_id: "company-acme",
        role: "hr_admin",
        full_name: "Alex Admin",
      }),
      { onConflict: "id" }
    );
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("allows the invite when no profiles row exists yet (defensive)", async () => {
    maybeSingle.mockResolvedValue({ data: null });

    const res = await provisionInvite(params);

    expect(res).toEqual({ ok: true });
    expect(upsert).toHaveBeenCalled();
  });

  it("refuses to clobber a pending invitee already provisioned to another company/role (E-new-6)", async () => {
    maybeSingle.mockResolvedValue({
      data: { role: "hr_admin", company_id: "other-company", onboarding_completed: false, tc_agreed_at: null },
    });

    const res = await provisionInvite(params);

    expect(res).toEqual({ ok: false, message: "Someone with that email already has an account." });
    expect(upsert).not.toHaveBeenCalled();
    // MUST NOT delete the existing account -- that would destroy the victim.
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("refuses to relocate a self-signup member (employee/DIRECT but already consented)", async () => {
    maybeSingle.mockResolvedValue({
      data: { role: "employee", company_id: DIRECT_COMPANY_ID, onboarding_completed: false, tc_agreed_at: "2026-01-01T00:00:00Z" },
    });

    const res = await provisionInvite(params);

    expect(res.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("refuses to clobber an already-onboarded account", async () => {
    maybeSingle.mockResolvedValue({
      data: { role: "employee", company_id: DIRECT_COMPANY_ID, onboarding_completed: true, tc_agreed_at: null },
    });

    const res = await provisionInvite(params);

    expect(res.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("rolls back the user THIS call created when the profile write fails", async () => {
    upsert.mockResolvedValue({ error: { message: "db down" } });

    const res = await provisionInvite(params);

    expect(res.ok).toBe(false);
    expect(deleteUser).toHaveBeenCalledWith("invitee-id");
  });

  it("surfaces the already-registered message when inviteUserByEmail rejects a confirmed email", async () => {
    inviteUserByEmail.mockResolvedValue({ data: { user: null }, error: { message: "User already registered" } });

    const res = await provisionInvite(params);

    expect(res).toEqual({ ok: false, message: "Someone with that email already has an account." });
    expect(upsert).not.toHaveBeenCalled();
  });
});
