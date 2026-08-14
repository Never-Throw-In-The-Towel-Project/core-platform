import { describe, expect, it } from "vitest";
import { extractTenantSlug, cookieDomainForHost, isHostUnderRootDomain } from "./resolve";

describe("extractTenantSlug", () => {
  it("returns null for the bare root domain", () => {
    expect(extractTenantSlug("neverthrowinthetowel.uk")).toBeNull();
  });

  it("returns null for the app.*, www.* and admin.* reserved subdomains", () => {
    expect(extractTenantSlug("app.neverthrowinthetowel.uk")).toBeNull();
    expect(extractTenantSlug("www.neverthrowinthetowel.uk")).toBeNull();
    expect(extractTenantSlug("admin.neverthrowinthetowel.uk")).toBeNull();
  });

  it("returns the slug for a real partner subdomain", () => {
    expect(extractTenantSlug("acme.neverthrowinthetowel.uk")).toBe("acme");
  });

  it("strips a port before matching", () => {
    expect(extractTenantSlug("acme.neverthrowinthetowel.uk:3000")).toBe("acme");
  });

  it("supports local dev via .localhost", () => {
    expect(extractTenantSlug("acme.localhost:3000")).toBe("acme");
  });

  it("returns null for bare localhost", () => {
    expect(extractTenantSlug("localhost:3000")).toBeNull();
  });

  it("returns null for a dotted (multi-level) candidate", () => {
    expect(extractTenantSlug("staging.acme.neverthrowinthetowel.uk")).toBeNull();
  });

  it("returns null for an unrelated host", () => {
    expect(extractTenantSlug("example.com")).toBeNull();
  });
});

describe("isHostUnderRootDomain", () => {
  it("is true for the root domain and its subdomains", () => {
    expect(isHostUnderRootDomain("neverthrowinthetowel.uk")).toBe(true);
    expect(isHostUnderRootDomain("admin.neverthrowinthetowel.uk")).toBe(true);
    expect(isHostUnderRootDomain("kpsnacks.neverthrowinthetowel.uk:443")).toBe(true);
  });

  it("is false for localhost, previews and lookalike hosts", () => {
    expect(isHostUnderRootDomain("localhost:3000")).toBe(false);
    expect(isHostUnderRootDomain("core-platform-psi.vercel.app")).toBe(false);
    expect(isHostUnderRootDomain("evilneverthrowinthetowel.uk")).toBe(false);
  });
});

describe("cookieDomainForHost", () => {
  it("scopes to the parent domain on the root and its subdomains", () => {
    expect(cookieDomainForHost("neverthrowinthetowel.uk")).toBe(".neverthrowinthetowel.uk");
    expect(cookieDomainForHost("admin.neverthrowinthetowel.uk")).toBe(".neverthrowinthetowel.uk");
    expect(cookieDomainForHost("kpsnacks.neverthrowinthetowel.uk:443")).toBe(".neverthrowinthetowel.uk");
  });

  it("is undefined off the root domain, so localhost + preview logins still work", () => {
    expect(cookieDomainForHost("localhost:3000")).toBeUndefined();
    expect(cookieDomainForHost("core-platform-psi.vercel.app")).toBeUndefined();
    // A lookalike suffix must not match (guards against a forged Host header).
    expect(cookieDomainForHost("evilneverthrowinthetowel.uk")).toBeUndefined();
  });
});
