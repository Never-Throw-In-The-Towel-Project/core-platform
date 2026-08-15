import { describe, it, expect } from "vitest";
import { COMMUNITY_TABS, visibleCommunityTabs } from "./tabs";

describe("visibleCommunityTabs", () => {
  it("shows every tab (incl. My Company) for a real company member", () => {
    const tabs = visibleCommunityTabs(true);
    expect(tabs.map((t) => t.href)).toEqual([
      "/community",
      "/community/wins",
      "/community/company",
      "/community/guidelines",
    ]);
  });

  it("hides only the My Company tab for a Direct member", () => {
    const tabs = visibleCommunityTabs(false);
    expect(tabs.map((t) => t.href)).toEqual([
      "/community",
      "/community/wins",
      "/community/guidelines",
    ]);
    expect(tabs.some((t) => t.href === "/community/company")).toBe(false);
    // Nothing else is dropped.
    expect(tabs).toHaveLength(COMMUNITY_TABS.length - 1);
  });

  it("marks the active tab by pathname prefix", () => {
    const wins = COMMUNITY_TABS.find((t) => t.href === "/community/wins")!;
    expect(wins.match("/community/wins")).toBe(true);
    expect(wins.match("/community/wins/anything")).toBe(true);
    expect(wins.match("/community")).toBe(false);
    // Feed is an exact match, not a prefix (so it isn't active on sub-routes).
    const feed = COMMUNITY_TABS.find((t) => t.href === "/community")!;
    expect(feed.match("/community")).toBe(true);
    expect(feed.match("/community/wins")).toBe(false);
  });
});
