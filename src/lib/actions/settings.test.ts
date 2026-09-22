import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({
  verifySession: () => Promise.resolve({ userId: "u1", email: "u@example.com" }),
}));

let lastUpdate: Record<string, unknown> | undefined;
// The profile row updateIdentity reads back to decide whether to regenerate the
// anon handle (only when appearing anonymously). Default: no row.
let currentProfile: { display_name: string; full_name: string } | null = null;
const eqMock = vi.fn(() => Promise.resolve({ error: null }));
const updateMock = vi.fn((values: Record<string, unknown>) => {
  lastUpdate = values;
  return { eq: eqMock };
});
const maybeSingleMock = vi.fn(() => Promise.resolve({ data: currentProfile }));
const selectMock = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })) }));
const fromMock = vi.fn(() => ({ update: updateMock, select: selectMock }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ from: fromMock }),
}));

const { updateIdentity } = await import("./settings");
const { initialRoutineState } = await import("./routineState");

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  lastUpdate = undefined;
  currentProfile = null;
  eqMock.mockResolvedValue({ error: null });
});

describe("updateIdentity", () => {
  it("writes full name, preference, and DOB when all supplied", async () => {
    const state = await updateIdentity(
      initialRoutineState,
      fd({ fullName: "Alex Morgan", identityPreference: "anonymous", dateOfBirth: "1990-05-01" })
    );
    expect(updateMock).toHaveBeenCalledWith({
      full_name: "Alex Morgan",
      community_identity_preference: "anonymous",
      date_of_birth: "1990-05-01",
    });
    expect(state.status).toBe("success");
  });

  it("regenerates the handle when going anonymous and the handle is still the real name (A3)", async () => {
    // Invited/legacy member: display_name == full_name (their real name).
    currentProfile = { display_name: "Alex Morgan", full_name: "Alex Morgan" };
    await updateIdentity(
      initialRoutineState,
      fd({ fullName: "Alex Morgan", identityPreference: "anonymous" })
    );
    // "u1" is the mocked session user id; generateAnonHandle("u1") === "Bold Lynx".
    expect(lastUpdate).toMatchObject({ display_name: "Bold Lynx" });
    expect(lastUpdate?.display_name).not.toBe("Alex Morgan");
  });

  it("leaves a customised handle untouched when going anonymous", async () => {
    currentProfile = { display_name: "Night Heron", full_name: "Alex Morgan" };
    await updateIdentity(
      initialRoutineState,
      fd({ fullName: "Alex Morgan", identityPreference: "anonymous" })
    );
    expect(lastUpdate).not.toHaveProperty("display_name");
  });

  it("never touches the handle for a non-anonymous preference", async () => {
    currentProfile = { display_name: "Alex Morgan", full_name: "Alex Morgan" };
    await updateIdentity(
      initialRoutineState,
      fd({ fullName: "Alex Morgan", identityPreference: "full_name" })
    );
    expect(lastUpdate).not.toHaveProperty("display_name");
  });

  it("omits date_of_birth when the field is blank (never clears a set DOB)", async () => {
    await updateIdentity(
      initialRoutineState,
      fd({ fullName: "Alex Morgan", identityPreference: "full_name", dateOfBirth: "" })
    );
    expect(lastUpdate).not.toHaveProperty("date_of_birth");
    expect(lastUpdate).toMatchObject({ full_name: "Alex Morgan", community_identity_preference: "full_name" });
  });

  it("rejects a blank full name without touching the DB", async () => {
    const state = await updateIdentity(
      initialRoutineState,
      fd({ fullName: "   ", identityPreference: "full_name" })
    );
    expect(state.status).toBe("error");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid preference", async () => {
    const state = await updateIdentity(
      initialRoutineState,
      fd({ fullName: "Alex Morgan", identityPreference: "bogus" })
    );
    expect(state.status).toBe("error");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects a future date of birth but does not age-gate", async () => {
    const future = await updateIdentity(
      initialRoutineState,
      fd({ fullName: "Alex Morgan", identityPreference: "full_name", dateOfBirth: "2999-01-01" })
    );
    expect(future.status).toBe("error");
    expect(updateMock).not.toHaveBeenCalled();

    const teen = await updateIdentity(
      initialRoutineState,
      fd({ fullName: "Alex Morgan", identityPreference: "full_name", dateOfBirth: "2012-01-01" })
    );
    expect(teen.status).toBe("success");
  });
});
