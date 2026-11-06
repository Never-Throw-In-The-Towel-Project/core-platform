import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildContentSecurityPolicy, securityHeaders, CSP_REPORT_PATH } from "./headers";

describe("E15 security headers", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("enforces the safe hardening headers", () => {
    const byKey = Object.fromEntries(securityHeaders().map((h) => [h.key, h.value]));
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(byKey["Strict-Transport-Security"]).toContain("max-age=");
    expect(byKey["Strict-Transport-Security"]).toContain("includeSubDomains");
    expect(byKey["Permissions-Policy"]).toContain("geolocation=()");
  });

  it("ships CSP in Report-Only mode, not enforcing (so it can't break a live page)", () => {
    const keys = securityHeaders().map((h) => h.key);
    expect(keys).toContain("Content-Security-Policy-Report-Only");
    expect(keys).not.toContain("Content-Security-Policy");
  });

  it("locks the sensitive directives down and wires the report sink", () => {
    const csp = buildContentSecurityPolicy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain(`report-uri ${CSP_REPORT_PATH}`);
  });

  it("allows the real origins the app loads (Supabase https+wss, Vimeo, YouTube)", () => {
    const csp = buildContentSecurityPolicy();
    expect(csp).toMatch(/connect-src[^;]*https:\/\/proj\.supabase\.co/);
    expect(csp).toMatch(/connect-src[^;]*wss:\/\/proj\.supabase\.co/);
    expect(csp).toMatch(/img-src[^;]*https:\/\/proj\.supabase\.co/);
    expect(csp).toMatch(/img-src[^;]*https:\/\/i\.vimeocdn\.com/);
    expect(csp).toMatch(/frame-src[^;]*https:\/\/player\.vimeo\.com/);
    expect(csp).toMatch(/frame-src[^;]*https:\/\/www\.youtube\.com/);
  });

  it("degrades gracefully when the Supabase URL is absent", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const csp = buildContentSecurityPolicy();
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain("null"); // no stray 'null' token from a missing origin
  });
});
