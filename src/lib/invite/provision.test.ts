import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const inviteUserByEmail = vi.fn();
const deleteUser = vi.fn(() => Promise.resolve({ error: null }));
const listUsers = vi.fn();
const maybeSingle = vi.fn();
const upsert = vi.fn();
const fromMock = vi.fn(() => ({
  // provision.ts pre-checks with .select(...).eq("id", ...).maybeSingle() and
  // then writes with .upsert(...). Both go through the same from("profiles").
  select: () => ({ eq: () => ({ maybeSingle }) }),
  upsert,
}));
const createAdminClientMock = vi.fn(() => ({
  auth: { admin: { inviteUserByEmail, deleteUser, listUsers } },
  from: fromMock,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClientMock(),
}));

const { provisionInvite, revokePendingInvite } = await import("./provision");
const { DIRECT_COMPANY_ID } = await import("@/lib/tenant/constants");

const params = {
  email: "invitee@acme.test",
  displayName: "Alex Admin",
  companyId: "company-acme",
  role: "hr_admin" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  // provisionInvite now logs the real cause on an inviteUserByEmail failure;
  // silence it so the error-path tests don't spew to the test console.
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.neverthrowinthetowel.uk");
  inviteUserByEmail.mockResolvedValue({ data: { user: { id: "invitee-id" } }, error: null });
  // Default: the handle_new_user trigger's untouched default row for a genuinely
  // new invite.
  maybeSingle.mockResolvedValue({
    data: { role: "employee", company_id: DIRECT_COMPANY_ID, onboarding_completed: false, tc_agreed_at: null },
  });
  upsert.mockResolvedValue({ error: null });
  deleteUser.mockResolvedValue({ error: null });
  listUsers.mockResolvedValue({ data: { users: [] }, error: null });
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

  it("maps GoTrue's email_exists code to a clear 'already has an account' message (the real duplicate-invite case)", async () => {
    // GoTrue phrases a duplicate as "...has already been registered" (note the
    // "been") and sets code "email_exists". Keying off the code, not the wording,
    // is what makes this surface a clear message instead of the generic "try
    // again" — the exact defect an admin hit re-inviting an existing super admin.
    inviteUserByEmail.mockResolvedValue({
      data: { user: null },
      error: { message: "A user with this email address has already been registered", code: "email_exists" },
    });

    const res = await provisionInvite(params);

    expect(res).toEqual({ ok: false, message: "Someone with that email already has an account." });
    expect(upsert).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it("maps a rate-limited auth email to an actionable 'wait and retry' message", async () => {
    inviteUserByEmail.mockResolvedValue({ data: { user: null }, error: { message: "email rate limit exceeded" } });

    const res = await provisionInvite(params);

    expect(res.ok).toBe(false);
    expect(res).toMatchObject({ message: expect.stringMatching(/wait a minute/i) });
    expect(upsert).not.toHaveBeenCalled();
    // The real cause is logged (diagnosability), not swallowed.
    expect(console.error).toHaveBeenCalled();
  });
});

describe("revokePendingInvite", () => {
  const pending = { id: "pending-id", email: "invitee@acme.test", email_confirmed_at: null, last_sign_in_at: null };

  it("deletes a never-accepted invite (ntitt scope, any company)", async () => {
    listUsers.mockResolvedValue({ data: { users: [pending] }, error: null });

    const res = await revokePendingInvite({ email: "invitee@acme.test", restrictToCompanyId: null });

    expect(res).toEqual({ ok: true });
    expect(deleteUser).toHaveBeenCalledWith("pending-id");
  });

  it("matches the email case-insensitively and trims it", async () => {
    listUsers.mockResolvedValue({ data: { users: [pending] }, error: null });

    const res = await revokePendingInvite({ email: "  Invitee@ACME.test ", restrictToCompanyId: null });

    expect(res.ok).toBe(true);
    expect(deleteUser).toHaveBeenCalledWith("pending-id");
  });

  it("refuses — and never deletes — an account that already confirmed its email", async () => {
    listUsers.mockResolvedValue({
      data: { users: [{ ...pending, email_confirmed_at: "2026-01-01T00:00:00Z" }] },
      error: null,
    });

    const res = await revokePendingInvite({ email: "invitee@acme.test", restrictToCompanyId: null });

    expect(res.ok).toBe(false);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("refuses — and never deletes — an account that has signed in before", async () => {
    listUsers.mockResolvedValue({
      data: { users: [{ ...pending, last_sign_in_at: "2026-01-01T00:00:00Z" }] },
      error: null,
    });

    const res = await revokePendingInvite({ email: "invitee@acme.test", restrictToCompanyId: null });

    expect(res.ok).toBe(false);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("refuses when no user matches the email", async () => {
    listUsers.mockResolvedValue({ data: { users: [{ ...pending, email: "someone-else@acme.test" }] }, error: null });

    const res = await revokePendingInvite({ email: "invitee@acme.test", restrictToCompanyId: null });

    expect(res).toEqual({ ok: false, message: "No pending invite found for that email." });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("hr_admin scope: deletes a pending EMPLOYEE invite at their own company", async () => {
    listUsers.mockResolvedValue({ data: { users: [pending] }, error: null });
    maybeSingle.mockResolvedValue({ data: { company_id: "company-acme", role: "employee" } });

    const res = await revokePendingInvite({ email: "invitee@acme.test", restrictToCompanyId: "company-acme" });

    expect(res).toEqual({ ok: true });
    expect(deleteUser).toHaveBeenCalledWith("pending-id");
  });

  it("hr_admin scope: refuses a pending invite at a DIFFERENT company", async () => {
    listUsers.mockResolvedValue({ data: { users: [pending] }, error: null });
    maybeSingle.mockResolvedValue({ data: { company_id: "other-company", role: "employee" } });

    const res = await revokePendingInvite({ email: "invitee@acme.test", restrictToCompanyId: "company-acme" });

    expect(res.ok).toBe(false);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("hr_admin scope: refuses a non-employee (privileged) pending invite at their company", async () => {
    listUsers.mockResolvedValue({ data: { users: [pending] }, error: null });
    maybeSingle.mockResolvedValue({ data: { company_id: "company-acme", role: "hr_admin" } });

    const res = await revokePendingInvite({ email: "invitee@acme.test", restrictToCompanyId: "company-acme" });

    expect(res.ok).toBe(false);
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
