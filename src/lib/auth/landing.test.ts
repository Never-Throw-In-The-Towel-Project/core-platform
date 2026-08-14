import { describe, expect, it, vi, beforeEach } from "vitest";

// landing.ts imports the server supabase factory (for its client type) and
// next/headers; mock their runtime deps so the module is importable in a unit
// test, the same pattern as signup.test.ts.
vi.mock("server-only", () => ({}));

const headersMock = vi.fn(() => new Map([["host", "app.neverthrowinthetowel.uk"]]));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(headersMock()),
  cookies: () => ({}),
}));

const { roleHomePath, roleHomeHost, crossSubdomainLanding, resolveLandingPath } = await import("./landing");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_ROOT_DOMAIN", "neverthrowinthetowel.uk");
  headersMock.mockReturnValue(new Map([["host", "app.neverthrowinthetowel.uk"]]));
});

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

describe("roleHomeHost", () => {
  it("maps ntitt_admin to the admin subdomain", () => {
    expect(roleHomeHost("ntitt_admin", "app.neverthrowinthetowel.uk", null)).toBe(
      "admin.neverthrowinthetowel.uk"
    );
  });

  it("maps hr_admin to their company subdomain", () => {
    expect(roleHomeHost("hr_admin", "app.neverthrowinthetowel.uk", "kpsnacks")).toBe(
      "kpsnacks.neverthrowinthetowel.uk"
    );
  });

  it("returns null (no bounce) when already on the right host", () => {
    expect(roleHomeHost("ntitt_admin", "admin.neverthrowinthetowel.uk", null)).toBeNull();
    expect(roleHomeHost("hr_admin", "kpsnacks.neverthrowinthetowel.uk", "kpsnacks")).toBeNull();
  });

  it("returns null for a member and for an hr_admin with no known slug", () => {
    expect(roleHomeHost("employee", "app.neverthrowinthetowel.uk", null)).toBeNull();
    expect(roleHomeHost("hr_admin", "app.neverthrowinthetowel.uk", null)).toBeNull();
  });
});

describe("crossSubdomainLanding", () => {
  it("returns an absolute URL on the role's own subdomain for a real host", () => {
    expect(crossSubdomainLanding("ntitt_admin", "/admin", "app.neverthrowinthetowel.uk", null)).toBe(
      "https://admin.neverthrowinthetowel.uk/admin"
    );
    expect(
      crossSubdomainLanding("hr_admin", "/workspace", "neverthrowinthetowel.uk", "kpsnacks")
    ).toBe("https://kpsnacks.neverthrowinthetowel.uk/workspace");
  });

  it("keeps the plain path when already on the right host", () => {
    expect(
      crossSubdomainLanding("hr_admin", "/workspace", "kpsnacks.neverthrowinthetowel.uk:443", "kpsnacks")
    ).toBe("/workspace");
  });

  it("never bounces on localhost or preview hosts", () => {
    expect(crossSubdomainLanding("ntitt_admin", "/admin", "localhost:3000", null)).toBe("/admin");
    expect(
      crossSubdomainLanding("hr_admin", "/workspace", "core-platform-psi.vercel.app", "kpsnacks")
    ).toBe("/workspace");
  });

  it("keeps the plain path for a member (no dedicated subdomain)", () => {
    expect(crossSubdomainLanding("employee", "/home", "app.neverthrowinthetowel.uk", null)).toBe("/home");
  });
});

// A minimal fake of the authenticated Supabase client: getUser() plus a
// from().select().eq().maybeSingle() chain that returns the profile for the
// `profiles` table and the company row for `companies`.
function fakeClient(opts: {
  user: { id: string } | null;
  profile?: Record<string, unknown> | null;
  company?: Record<string, unknown> | null;
}) {
  return {
    auth: { getUser: async () => ({ data: { user: opts.user } }) },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: table === "profiles" ? (opts.profile ?? null) : (opts.company ?? null),
          }),
        }),
      }),
    }),
  } as unknown as Parameters<typeof resolveLandingPath>[0];
}

describe("resolveLandingPath", () => {
  it("bounces an ntitt_admin logging in at app. to the admin subdomain", async () => {
    const client = fakeClient({
      user: { id: "u1" },
      profile: { role: "ntitt_admin", onboarding_completed: true, company_id: null },
    });

    expect(await resolveLandingPath(client, null)).toBe("https://admin.neverthrowinthetowel.uk/admin");
  });

  it("bounces an hr_admin to their company subdomain, resolving the slug", async () => {
    const client = fakeClient({
      user: { id: "u2" },
      profile: { role: "hr_admin", onboarding_completed: true, company_id: "c1" },
      company: { slug: "kpsnacks" },
    });

    expect(await resolveLandingPath(client, null)).toBe(
      "https://kpsnacks.neverthrowinthetowel.uk/workspace"
    );
  });

  it("keeps a member on the current host", async () => {
    const client = fakeClient({
      user: { id: "u3" },
      profile: { role: "employee", onboarding_completed: true, company_id: "c1" },
    });

    expect(await resolveLandingPath(client, null)).toBe("/home");
  });

  it("honours an explicit next and never bounces it across hosts", async () => {
    const client = fakeClient({
      user: { id: "u4" },
      profile: { role: "ntitt_admin", onboarding_completed: true, company_id: null },
    });

    expect(await resolveLandingPath(client, "/admin/companies/abc")).toBe("/admin/companies/abc");
  });

  it("sends an un-onboarded user to /onboarding regardless of role", async () => {
    const client = fakeClient({
      user: { id: "u5" },
      profile: { role: "hr_admin", onboarding_completed: false, company_id: "c1" },
    });

    expect(await resolveLandingPath(client, null)).toBe("/onboarding");
  });

  it("does not bounce on a preview host", async () => {
    headersMock.mockReturnValue(new Map([["host", "core-platform-psi.vercel.app"]]));
    const client = fakeClient({
      user: { id: "u6" },
      profile: { role: "ntitt_admin", onboarding_completed: true, company_id: null },
    });

    expect(await resolveLandingPath(client, null)).toBe("/admin");
  });
});
