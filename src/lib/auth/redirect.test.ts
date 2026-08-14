import { describe, expect, it } from "vitest";
import { isSafeRedirectPath } from "./redirect";

describe("isSafeRedirectPath", () => {
  it("accepts a plain same-origin absolute path", () => {
    expect(isSafeRedirectPath("/")).toBe(true);
    expect(isSafeRedirectPath("/home")).toBe(true);
    expect(isSafeRedirectPath("/admin/companies/abc")).toBe(true);
    expect(isSafeRedirectPath("/workspace?tab=people")).toBe(true);
  });

  it("rejects protocol-relative and absolute URLs", () => {
    expect(isSafeRedirectPath("//evil.com")).toBe(false);
    expect(isSafeRedirectPath("https://evil.com")).toBe(false);
    expect(isSafeRedirectPath("http://evil.com")).toBe(false);
  });

  it("rejects backslash variants that browsers fold to `/` (open-redirect vector)", () => {
    // new URL("/\\evil.com", origin).host === "evil.com" -- these must NOT pass.
    expect(isSafeRedirectPath("/\\evil.com")).toBe(false);
    expect(isSafeRedirectPath("/\\/evil.com")).toBe(false);
    expect(isSafeRedirectPath("/\\\\evil.com")).toBe(false);
    expect(isSafeRedirectPath("\\evil.com")).toBe(false);
  });

  it("rejects a path that doesn't start at the origin root", () => {
    expect(isSafeRedirectPath("home")).toBe(false);
    expect(isSafeRedirectPath("javascript:alert(1)")).toBe(false);
    expect(isSafeRedirectPath("")).toBe(false);
  });
});
