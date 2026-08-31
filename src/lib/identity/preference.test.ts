import { describe, it, expect } from "vitest";
import { IDENTITY_PREFERENCES, isIdentityPreference, generateAnonHandle } from "./preference";

describe("identity preference", () => {
  it("offers exactly the three schema-backed levels", () => {
    expect(IDENTITY_PREFERENCES.map((p) => p.value)).toEqual([
      "full_name",
      "first_name_only",
      "anonymous",
    ]);
  });

  it("guards the preference value", () => {
    expect(isIdentityPreference("anonymous")).toBe(true);
    expect(isIdentityPreference("full_name")).toBe(true);
    expect(isIdentityPreference("bogus")).toBe(false);
    expect(isIdentityPreference(undefined)).toBe(false);
    expect(isIdentityPreference(null)).toBe(false);
  });
});

describe("generateAnonHandle", () => {
  it("is deterministic in the seed", () => {
    const id = "a927c545-9237-8292-23da-c3bf975efd1e";
    expect(generateAnonHandle(id)).toBe(generateAnonHandle(id));
  });

  it("produces a friendly 'Adjective Animal' two-word handle", () => {
    const handle = generateAnonHandle("some-user-id");
    expect(handle).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it("does not leak the seed, and never throws on an empty seed", () => {
    expect(generateAnonHandle("")).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    expect(generateAnonHandle("Alex Morgan")).not.toContain("Alex");
  });

  it("varies across different seeds (not all one bucket)", () => {
    const handles = new Set(
      ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8"].map(generateAnonHandle)
    );
    expect(handles.size).toBeGreaterThan(1);
  });
});
