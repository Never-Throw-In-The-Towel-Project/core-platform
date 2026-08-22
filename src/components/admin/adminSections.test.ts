import { describe, it, expect } from "vitest";
import { activeAdminSection, isAdminSectionActive } from "./adminSections";

describe("isAdminSectionActive", () => {
  it("matches a section on its own page and sub-routes", () => {
    expect(isAdminSectionActive("/admin/content", "/admin/content")).toBe(true);
    expect(isAdminSectionActive("/admin/content/new", "/admin/content")).toBe(true);
  });

  it("does not match on a shared prefix that isn't a path boundary", () => {
    // "/admin/contentx" starts with "/admin/content" but is a different route.
    expect(isAdminSectionActive("/admin/contentx", "/admin/content")).toBe(false);
  });

  it("treats the Overview home as exact-match only", () => {
    expect(isAdminSectionActive("/admin", "/admin")).toBe(true);
    // The bug this guards: "/admin" is a prefix of every section route, so a
    // naive prefix match would light Overview up (and steal the breadcrumb)
    // on every admin page.
    expect(isAdminSectionActive("/admin/content", "/admin")).toBe(false);
    expect(isAdminSectionActive("/admin/companies", "/admin")).toBe(false);
  });
});

describe("activeAdminSection", () => {
  it("resolves the home to Overview and sub-pages to their own section", () => {
    expect(activeAdminSection("/admin")?.label).toBe("Overview");
    expect(activeAdminSection("/admin/content")?.label).toBe("Content Studio");
    expect(activeAdminSection("/admin/companies")?.label).toBe("Companies");
    expect(activeAdminSection("/admin/events/123")?.label).toBe("Events");
  });
});
