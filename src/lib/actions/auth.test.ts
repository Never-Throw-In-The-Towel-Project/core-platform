import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ verifySession: vi.fn() }));
vi.mock("@/lib/auth/landing", () => ({ resolveLandingPath: vi.fn() }));
vi.mock("@/lib/auth/redirect", () => ({ isSafeRedirectPath: () => true }));

const resetMock = vi.fn(() => Promise.resolve({ data: {}, error: null }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { resetPasswordForEmail: resetMock } }),
}));

const { requestPasswordReset } = await import("./auth");

function form(email: unknown): FormData {
  const f = new FormData();
  if (email !== undefined) f.set("email", String(email));
  return f;
}

describe("requestPasswordReset (forgot-password)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.neverthrowinthetowel.uk");
    resetMock.mockResolvedValue({ data: {}, error: null });
  });

  it("sends a recovery email whose link lands on /reset-password", async () => {
    const res = await requestPasswordReset({ status: "idle" }, form("member@acme.test"));

    expect(res).toEqual({ status: "sent" });
    expect(resetMock).toHaveBeenCalledTimes(1);
    const [email, options] = resetMock.mock.calls[0] as unknown as [string, { redirectTo: string }];
    expect(email).toBe("member@acme.test");
    expect(options.redirectTo).toContain("/auth/confirm");
    expect(decodeURIComponent(options.redirectTo)).toContain("next=/reset-password");
  });

  it("rejects an invalid email without sending anything", async () => {
    const res = await requestPasswordReset({ status: "idle" }, form("not-an-email"));

    expect(res.status).toBe("error");
    expect(resetMock).not.toHaveBeenCalled();
  });

  it("anti-enumeration: still returns 'sent' when the send throws", async () => {
    resetMock.mockRejectedValue(new Error("boom"));

    const res = await requestPasswordReset({ status: "idle" }, form("member@acme.test"));

    expect(res).toEqual({ status: "sent" });
  });

  it("does not send (but still reports 'sent') when the site URL is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

    const res = await requestPasswordReset({ status: "idle" }, form("member@acme.test"));

    expect(res).toEqual({ status: "sent" });
    expect(resetMock).not.toHaveBeenCalled();
  });
});
