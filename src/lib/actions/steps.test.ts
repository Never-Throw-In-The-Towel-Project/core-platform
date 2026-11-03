import { describe, it, expect, vi, beforeEach } from "vitest";
import { initialRoutineState } from "./routineState";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({
  verifySession: vi.fn(async () => ({ userId: "u1" })),
  getProfile: vi.fn(async () => ({ id: "u1", timezone: "UTC" })),
}));

// step_entries has one write path here: .from("step_entries").upsert(payload).
const upsertMock = vi.fn<(...args: unknown[]) => Promise<{ error: null }>>(() =>
  Promise.resolve({ error: null })
);
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: () => ({ upsert: upsertMock }) })),
}));

const { logStepsAction } = await import("./steps");

function fd(steps: string | null): FormData {
  const f = new FormData();
  if (steps !== null) f.set("steps", steps);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  upsertMock.mockResolvedValue({ error: null });
});

describe("logStepsAction (E3 -- a blank submit must never overwrite a real count with 0)", () => {
  it("writes a real step count", async () => {
    const res = await logStepsAction(initialRoutineState, fd("8000"));
    expect(res).toEqual({ status: "success" });
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0][0]).toMatchObject({ steps: 8000 });
  });

  it("does NOT touch step_entries on a blank submit -- the E3 guard", async () => {
    const res = await logStepsAction(initialRoutineState, fd(""));
    expect(upsertMock).not.toHaveBeenCalled();
    expect(res).toEqual({ status: "error", message: "Enter your steps as a whole number." });
  });

  it("does NOT write on a whitespace-only submit", async () => {
    const res = await logStepsAction(initialRoutineState, fd("   "));
    expect(upsertMock).not.toHaveBeenCalled();
    expect(res.status).toBe("error");
  });

  it("does NOT write when the field is absent entirely", async () => {
    const res = await logStepsAction(initialRoutineState, fd(null));
    expect(upsertMock).not.toHaveBeenCalled();
    expect(res.status).toBe("error");
  });

  it("still allows an explicit 0 (a logged rest day), writing a real 0 rather than a blank one", async () => {
    const res = await logStepsAction(initialRoutineState, fd("0"));
    expect(res).toEqual({ status: "success" });
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0][0]).toMatchObject({ steps: 0 });
  });

  it("rejects a non-numeric submit without writing", async () => {
    const res = await logStepsAction(initialRoutineState, fd("abc"));
    expect(upsertMock).not.toHaveBeenCalled();
    expect(res.status).toBe("error");
  });
});
