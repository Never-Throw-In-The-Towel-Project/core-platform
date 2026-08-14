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

  it("does not match an unrelated gated path", () => {
    expect(isPublicPath("/home")).toBe(false);
    expect(isPublicPath("/signup-not-a-real-path")).toBe(false);
  });
});
