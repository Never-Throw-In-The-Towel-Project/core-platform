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

  it("does not match an unrelated gated path", () => {
    expect(isPublicPath("/home")).toBe(false);
    expect(isPublicPath("/signup-not-a-real-path")).toBe(false);
  });
});
