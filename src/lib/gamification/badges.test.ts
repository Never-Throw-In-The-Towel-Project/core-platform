import { describe, it, expect } from "vitest";
import {
  evaluateBadges,
  countEarned,
  newlyEarnedKeys,
  badgeLabel,
  AWARDED_BADGES,
  type BadgeStatsInput,
} from "./badges";

const ZERO: BadgeStatsInput = {
  activeDayCount: 0,
  morningCount: 0,
  nightCount: 0,
  themedCount: 0,
  postCount: 0,
  winsCount: 0,
  maxSingleDaySteps: 0,
  bestStepStreak: 0,
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

describe("step-milestone badges", () => {
  it("earns 10K Club from a single 10,000-step day, independent of streak", () => {
    const badges = evaluateBadges({ ...ZERO, maxSingleDaySteps: 10000 });
    const earned = new Set(badges.filter((b) => b.earned).map((b) => b.key));
    expect(earned).toEqual(new Set(["steps_10k_club"]));
  });

  it("does not earn 10K Club below 10,000", () => {
    const badges = evaluateBadges({ ...ZERO, maxSingleDaySteps: 9999 });
    expect(badges.find((b) => b.key === "steps_10k_club")!.earned).toBe(false);
  });

  it("earns Week Streak at 7 consecutive days but not 30 Day Mover yet", () => {
    const badges = evaluateBadges({ ...ZERO, bestStepStreak: 7 });
    const earned = new Set(badges.filter((b) => b.earned).map((b) => b.key));
    expect(earned.has("steps_week_streak")).toBe(true);
    expect(earned.has("steps_30_day_mover")).toBe(false);
  });

  it("earns both streak badges at 30 consecutive days", () => {
    const badges = evaluateBadges({ ...ZERO, bestStepStreak: 30 });
    const earned = new Set(badges.filter((b) => b.earned).map((b) => b.key));
    expect(earned.has("steps_week_streak")).toBe(true);
    expect(earned.has("steps_30_day_mover")).toBe(true);
  });
});

describe("badgeLabel", () => {
  it("maps a known key to its label", () => {
    expect(badgeLabel("first_week")).toBe("First Week");
  });

  it("maps a step badge key to its label", () => {
    expect(badgeLabel("steps_10k_club")).toBe("10K Club");
  });
  it("falls back to the key for an unknown badge", () => {
    expect(badgeLabel("mystery")).toBe("mystery");
  });

  it("resolves each awarded badge key to its label", () => {
    for (const a of AWARDED_BADGES) {
      expect(badgeLabel(a.key)).toBe(a.label);
    }
  });
});

describe("AWARDED_BADGES", () => {
  it("covers the three awarded keys with an earn hint each", () => {
    expect(AWARDED_BADGES.map((a) => a.key)).toEqual(["challenge_complete", "team_mvp", "habit_complete"]);
    for (const a of AWARDED_BADGES) {
      expect(a.earnHint.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
    }
  });

  it("is disjoint from the stat-derived catalogue (no key can be both)", () => {
    const catalogue = new Set(evaluateBadges(ZERO).map((b) => b.key));
    for (const a of AWARDED_BADGES) {
      expect(catalogue.has(a.key)).toBe(false);
    }
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
