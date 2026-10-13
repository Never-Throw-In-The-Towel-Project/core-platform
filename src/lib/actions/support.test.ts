import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (...args: unknown[]) => redirectMock(...args) }));

const verifyAckTokenMock = vi.fn();
vi.mock("@/lib/support/alert", () => ({
  verifyAckToken: (...args: unknown[]) => verifyAckTokenMock(...args),
  dispatchSupportAlert: vi.fn(),
}));

// support.ts also imports these for submitSupportRequest; stub so the module loads.
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ getProfile: vi.fn() }));

// The ack action's chain: admin.from(...).update(...).eq(...).eq(...).select(...).maybeSingle()
const maybeSingleMock = vi.fn();
const updateMock = vi.fn();
const chain = {
  update: (...a: unknown[]) => {
    updateMock(...a);
    return chain;
  },
  eq: () => chain,
  select: () => chain,
  maybeSingle: () => maybeSingleMock(),
};
const createAdminClientMock = vi.fn(() => ({ from: () => chain }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => createAdminClientMock() }));

const { acknowledgeSupportRequest } = await import("./support");

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  maybeSingleMock.mockResolvedValue({ data: { id: "req-1" } });
});

describe("acknowledgeSupportRequest (E5 -- POST-only ack)", () => {
  it("marks a request contacted on a valid token and redirects to the contacted result", async () => {
    verifyAckTokenMock.mockResolvedValue(true);
    maybeSingleMock.mockResolvedValue({ data: { id: "req-1" } });

    await acknowledgeSupportRequest(fd({ request: "req-1", token: "good" }));

    expect(verifyAckTokenMock).toHaveBeenCalledWith("req-1", "good");
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "contacted" }));
    expect(redirectMock).toHaveBeenCalledWith("/support/ack?done=contacted");
  });

  it("redirects to 'already' when the request was no longer 'new' (idempotent)", async () => {
    verifyAckTokenMock.mockResolvedValue(true);
    maybeSingleMock.mockResolvedValue({ data: null });

    await acknowledgeSupportRequest(fd({ request: "req-1", token: "good" }));

    expect(redirectMock).toHaveBeenCalledWith("/support/ack?done=already");
  });

  it("never touches the DB on an invalid token (the real gate, not the page)", async () => {
    verifyAckTokenMock.mockResolvedValue(false);

    await acknowledgeSupportRequest(fd({ request: "req-1", token: "forged" }));

    expect(updateMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/support/ack?done=error");
  });

  it("never touches the DB when the token or id is missing", async () => {
    await acknowledgeSupportRequest(fd({ request: "req-1" }));

    expect(verifyAckTokenMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/support/ack?done=error");
  });
});
