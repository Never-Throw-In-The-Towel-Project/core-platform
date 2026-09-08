import { describe, it, expect } from "vitest";
import { PRIMARY_NAV_TABS } from "./primaryNav";

const tab = (label: string) => PRIMARY_NAV_TABS.find((t) => t.label === label)!;
const activeLabels = (pathname: string) => PRIMARY_NAV_TABS.filter((t) => t.match(pathname)).map((t) => t.label);

describe("PRIMARY_NAV_TABS", () => {
  it("lists Today, Feed, Wins, Events, Training in order", () => {
    expect(PRIMARY_NAV_TABS.map((t) => t.label)).toEqual(["Today", "Feed", "Wins", "Events", "Training"]);
    expect(tab("Wins").href).toBe("/community/wins");
  });

  it("keeps Feed and Wins mutually exclusive on community routes", () => {
    // Feed owns the feed itself and non-wins sub-paths (e.g. My Company)...
    expect(activeLabels("/community")).toEqual(["Feed"]);
    expect(activeLabels("/community/company")).toEqual(["Feed"]);
    // ...but never a wins path, which is Wins' alone.
    expect(activeLabels("/community/wins")).toEqual(["Wins"]);
    expect(activeLabels("/community/wins/anything")).toEqual(["Wins"]);
  });

  it("marks exactly one tab active for each primary route", () => {
    expect(activeLabels("/home")).toEqual(["Today"]);
    expect(activeLabels("/events")).toEqual(["Events"]);
    expect(activeLabels("/events/123")).toEqual(["Events"]);
    expect(activeLabels("/content")).toEqual(["Training"]);
    expect(activeLabels("/content/abc")).toEqual(["Training"]);
  });

  it("matches a tab on its own href or a sub-path, not a sibling prefix", () => {
    expect(tab("Today").match("/home")).toBe(true);
    expect(tab("Today").match("/home/x")).toBe(true);
    expect(tab("Today").match("/homework")).toBe(false); // not a real path, but guards the boundary
    expect(tab("Wins").match("/community")).toBe(false);
  });
});
