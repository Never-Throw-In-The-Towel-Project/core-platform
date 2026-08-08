import { describe, expect, it } from "vitest";
import { extractTenantSlug } from "./resolve";

describe("extractTenantSlug", () => {
  it("returns null for the bare root domain", () => {
    expect(extractTenantSlug("ntitt.co.uk")).toBeNull();
  });

  it("returns null for the app.* and www.* reserved subdomains", () => {
    expect(extractTenantSlug("app.ntitt.co.uk")).toBeNull();
    expect(extractTenantSlug("www.ntitt.co.uk")).toBeNull();
  });

  it("returns the slug for a real partner subdomain", () => {
    expect(extractTenantSlug("acme.ntitt.co.uk")).toBe("acme");
  });

  it("strips a port before matching", () => {
    expect(extractTenantSlug("acme.ntitt.co.uk:3000")).toBe("acme");
  });

  it("supports local dev via .localhost", () => {
    expect(extractTenantSlug("acme.localhost:3000")).toBe("acme");
  });

  it("returns null for bare localhost", () => {
    expect(extractTenantSlug("localhost:3000")).toBeNull();
  });

  it("returns null for a dotted (multi-level) candidate", () => {
    expect(extractTenantSlug("staging.acme.ntitt.co.uk")).toBeNull();
  });

  it("returns null for an unrelated host", () => {
    expect(extractTenantSlug("example.com")).toBeNull();
  });
});
