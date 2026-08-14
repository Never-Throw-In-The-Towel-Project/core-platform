import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const resolveCompanyForHost = vi.fn();
vi.mock("@/lib/tenant/resolve", () => ({
  resolveCompanyForHost: (...args: unknown[]) => resolveCompanyForHost(...args),
}));

const headersMock = vi.fn(() => new Map([["host", "ntitt.co.uk"]]));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(headersMock()),
}));

const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

const signUpMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { signUp: signUpMock } }),
}));

const profilesUpsertMock = vi.fn();
const createAdminClientMock = vi.fn(() => ({
  from: () => ({ upsert: profilesUpsertMock }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClientMock(),
}));

const { signUp } = await import("./signup");
const { DIRECT_COMPANY_ID } = await import("@/lib/tenant/constants");
const { initialRoutineState } = await import("./routineState");

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const validFields = {
  email: "new.user@example.com",
  password: "password123",
  confirmPassword: "password123",
  displayName: "New User",
  consent: "yes",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.ntitt.co.uk");
  resolveCompanyForHost.mockResolvedValue(null);
  headersMock.mockReturnValue(new Map([["host", "ntitt.co.uk"]]));
  profilesUpsertMock.mockResolvedValue({ error: null });
});

describe("signUp", () => {
  it("refuses to run on a partner subdomain, without ever calling auth.signUp", async () => {
    resolveCompanyForHost.mockResolvedValue({ id: "partner-co", slug: "acme" });

    const state = await signUp(initialRoutineState, formData(validFields));

    expect(state.status).toBe("error");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("refuses without consent to the terms and privacy policy", async () => {
    const state = await signUp(
      initialRoutineState,
      formData({
        email: validFields.email,
        password: validFields.password,
        confirmPassword: validFields.confirmPassword,
        displayName: validFields.displayName,
      })
    );

    expect(state.status).toBe("error");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("rejects invalid input before calling auth.signUp", async () => {
    const state = await signUp(
      initialRoutineState,
      formData({ ...validFields, confirmPassword: "different" })
    );

    expect(state.status).toBe("error");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("provisions a genuinely new user with the direct company id and employee role", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "new-user-id", identities: [{ id: "identity-1" }] }, session: null },
      error: null,
    });

    const state = await signUp(initialRoutineState, formData(validFields));

    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: validFields.email,
        password: validFields.password,
        options: expect.objectContaining({
          data: {
            company_id: DIRECT_COMPANY_ID,
            role: "employee",
            display_name: validFields.displayName,
          },
        }),
      })
    );
    expect(profilesUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "new-user-id",
        company_id: DIRECT_COMPANY_ID,
        role: "employee",
        display_name: validFields.displayName,
      }),
      { onConflict: "id" }
    );
    expect(state.status).toBe("success");
  });

  it("redirects immediately when signUp already returns a session", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "new-user-id", identities: [{ id: "identity-1" }] }, session: { access_token: "t" } },
      error: null,
    });

    await signUp(initialRoutineState, formData(validFields));

    expect(redirectMock).toHaveBeenCalledWith("/onboarding");
  });

  it("never upserts a profile for an already-registered email (anti-enumeration)", async () => {
    // Supabase's own anti-enumeration behavior: an existing email with
    // confirmation required comes back as a "successful" signUp with an
    // empty identities array, not an error.
    signUpMock.mockResolvedValue({
      data: { user: { id: "someone-elses-id", identities: [] }, session: null },
      error: null,
    });

    const state = await signUp(initialRoutineState, formData(validFields));

    expect(profilesUpsertMock).not.toHaveBeenCalled();
    // Response is indistinguishable from the genuine-new-user success path.
    expect(state.status).toBe("success");
  });

  it("returns a generic error message on a Supabase error, never the raw message", async () => {
    signUpMock.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "User already registered" },
    });

    const state = await signUp(initialRoutineState, formData(validFields));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.message).not.toMatch(/already registered/i);
    }
    expect(profilesUpsertMock).not.toHaveBeenCalled();
  });
});
