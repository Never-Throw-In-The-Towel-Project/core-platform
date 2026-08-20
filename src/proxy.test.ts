import { describe, expect, it } from "vitest";
import { isPublicPath, PUBLIC_PATHS } from "./proxy";

describe("isPublicPath", () => {
  it("matches every declared public path exactly", () => {
    for (const path of PUBLIC_PATHS) {
      expect(isPublicPath(path)).toBe(true);
    }
  });

  it("matches /signup and its sub-paths", () => {
    expect(isPublicPath("/signup")).toBe(true);
    expect(isPublicPath("/signup/anything")).toBe(true);
  });

  it("treats the public legal pages as reachable while logged out", () => {
    // Regression guard: these were added under (marketing) + linked from the
    // footer and signup, but must not be gated behind /login.
    expect(isPublicPath("/privacy")).toBe(true);
    expect(isPublicPath("/terms")).toBe(true);
  });

  it("treats the auth-landing routes as reachable while logged out", () => {
    // Regression guard (see #164): the user clicking an emailed sign-in /
    // confirmation / recovery link is LOGGED OUT, so both auth landings must be
    // public -- gating them bounces the user to /login and drops the token
    // before verifyOtp / the PKCE exchange ever runs, silently breaking auth.
    expect(isPublicPath("/auth/callback")).toBe(true); // PKCE code exchange
    expect(isPublicPath("/auth/confirm")).toBe(true); // token-hash verifyOtp (branded auth emails)
  });

  it("does not match an unrelated gated path", () => {
    expect(isPublicPath("/home")).toBe(false);
    expect(isPublicPath("/signup-not-a-real-path")).toBe(false);
    // The prefix match must not treat a look-alike as public.
    expect(isPublicPath("/auth/confirmation-elsewhere")).toBe(false);
  });
});
