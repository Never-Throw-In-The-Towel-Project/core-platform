import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({
  verifySession: () => Promise.resolve({ userId: "u1", email: "u@example.com" }),
}));

let lastUpdate: Record<string, unknown> | undefined;
const eqMock = vi.fn(() => Promise.resolve({ error: null }));
const updateMock = vi.fn((values: Record<string, unknown>) => {
  lastUpdate = values;
  return { eq: eqMock };
});
const fromMock = vi.fn(() => ({ update: updateMock }));
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
