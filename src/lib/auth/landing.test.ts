import { describe, expect, it, vi } from "vitest";

// landing.ts imports the server supabase factory (for its client type); mock
// its runtime deps so the pure roleHomePath is importable in a unit test, the
// same pattern as signup.test.ts.
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: () => ({}) }));

const { roleHomePath } = await import("./landing");

describe("roleHomePath", () => {
  it("sends ntitt_admin to the Control Tower", () => {
    expect(roleHomePath("ntitt_admin")).toBe("/admin");
  });

  it("sends hr_admin to their Workspace", () => {
    expect(roleHomePath("hr_admin")).toBe("/workspace");
  });

  it("sends employees to the member Today screen", () => {
    expect(roleHomePath("employee")).toBe("/home");
  });
});
