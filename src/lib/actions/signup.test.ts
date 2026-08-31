import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateAnonHandle } from "@/lib/identity/preference";
import { CURRENT_TERMS_VERSION } from "@/lib/legal/consent";

vi.mock("server-only", () => ({}));

const resolveCompanyForHost = vi.fn();
vi.mock("@/lib/tenant/resolve", () => ({
  resolveCompanyForHost: (...args: unknown[]) => resolveCompanyForHost(...args),
}));

const headersMock = vi.fn(() => new Map([["host", "neverthrowinthetowel.uk"]]));
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
  fullName: "New User",
  dateOfBirth: "1990-05-01",
  identityPreference: "anonymous",
  consent: "yes",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.neverthrowinthetowel.uk");
  resolveCompanyForHost.mockResolvedValue(null);
  headersMock.mockReturnValue(new Map([["host", "neverthrowinthetowel.uk"]]));
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
        fullName: validFields.fullName,
        dateOfBirth: validFields.dateOfBirth,
        identityPreference: validFields.identityPreference,
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

  it("rejects a missing date of birth before calling auth.signUp", async () => {
    const state = await signUp(
      initialRoutineState,
      formData({
        email: validFields.email,
        password: validFields.password,
        confirmPassword: validFields.confirmPassword,
        fullName: validFields.fullName,
        identityPreference: validFields.identityPreference,
        consent: "yes",
      })
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
            display_name: validFields.fullName,
          },
        }),
      })
    );
    // The REAL name goes to full_name; the public handle is a generated
    // non-identifying nickname; DOB + anonymity preference + recorded consent
    // are all written server-side via the service-role upsert.
    expect(profilesUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "new-user-id",
        company_id: DIRECT_COMPANY_ID,
        role: "employee",
        full_name: validFields.fullName,
        display_name: generateAnonHandle("new-user-id"),
        date_of_birth: validFields.dateOfBirth,
        community_identity_preference: "anonymous",
        tc_version: CURRENT_TERMS_VERSION,
        tc_agreed_at: expect.any(String),
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

  it("degrades to an error state (never throws) when NEXT_PUBLIC_SITE_URL is unset", async () => {
    // The email callback URL is built with `new URL(…, NEXT_PUBLIC_SITE_URL)`,
    // which throws on an unset/empty base. It sits inside the action's own
    // try/catch so a misconfigured deploy surfaces this form's inline error
    // instead of crashing uncaught to Next's generic error page.
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

    const state = await signUp(initialRoutineState, formData(validFields));

    expect(state.status).toBe("error");
    expect(signUpMock).not.toHaveBeenCalled();
  });
});
