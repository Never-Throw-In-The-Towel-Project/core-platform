import { describe, it, expect } from "vitest";
import { evaluateBadges, countEarned, newlyEarnedKeys, badgeLabel, type BadgeStatsInput } from "./badges";

const ZERO: BadgeStatsInput = {
  activeDayCount: 0,
  morningCount: 0,
  nightCount: 0,
  themedCount: 0,
  postCount: 0,
  winsCount: 0,
};

describe("evaluateBadges", () => {
  it("earns nothing for a brand-new user", () => {
    expect(countEarned(evaluateBadges(ZERO))).toBe(0);
  });

  it("earns the thresholds a member has crossed, and only those", () => {
    const badges = evaluateBadges({ ...ZERO, activeDayCount: 10, nightCount: 2, winsCount: 6, postCount: 1 });
    const earned = new Set(badges.filter((b) => b.earned).map((b) => b.key));
    // active >= 7 and >= 10, night >= 1, wins >= 5, post >= 1 -> not thirty_days
    expect(earned).toEqual(new Set(["first_week", "ten_days", "first_post", "night_owl", "five_wins"]));
    expect(earned.has("thirty_days")).toBe(false);
  });
});

describe("badgeLabel", () => {
  it("maps a known key to its label", () => {
    expect(badgeLabel("first_week")).toBe("First Week");
  });
  it("falls back to the key for an unknown badge", () => {
    expect(badgeLabel("mystery")).toBe("mystery");
  });
});

describe("newlyEarnedKeys", () => {
  it("returns earned keys not already persisted", () => {
    const badges = evaluateBadges({ ...ZERO, activeDayCount: 7, nightCount: 1 });
    // earns first_week + night_owl; night_owl already persisted
    expect(newlyEarnedKeys(badges, ["night_owl"])).toEqual(["first_week"]);
  });

  it("returns nothing when all earned badges are already persisted", () => {
    const badges = evaluateBadges({ ...ZERO, activeDayCount: 7 });
    expect(newlyEarnedKeys(badges, ["first_week"])).toEqual([]);
  });

  it("never returns an unearned badge even if the persisted set is empty", () => {
    expect(newlyEarnedKeys(evaluateBadges(ZERO), [])).toEqual([]);
  });
});
