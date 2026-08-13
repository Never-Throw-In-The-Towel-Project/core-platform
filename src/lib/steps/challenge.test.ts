import { describe, it, expect } from "vitest";
import {
  computeStepTotals,
  optedInPercent,
  daysRemaining,
  progressPercent,
  STEP_CHALLENGE_MIN_CONTRIBUTORS,
} from "./challenge";

describe("computeStepTotals (k-anon floor)", () => {
  it("suppresses the total below the contributor floor, storing 0 -- never a revealing number", () => {
    // 4 contributors, floor is 5
    const r = computeStepTotals([10000, 20000, 30000, 40000], 1_000_000);
    expect(r.suppressed).toBe(true);
    expect(r.totalSteps).toBe(0);
    expect(r.targetReached).toBe(false);
    expect(r.contributorCount).toBe(4);
  });

  it("reveals the total once the floor is met", () => {
    const r = computeStepTotals([1000, 2000, 3000, 4000, 5000], 100_000);
    expect(r.suppressed).toBe(false);
    expect(r.totalSteps).toBe(15000);
    expect(r.contributorCount).toBe(5);
  });

  it("does not count zero-step members toward the floor", () => {
    // 5 opted-in members but only 4 actually contributed steps -> still suppressed
    const r = computeStepTotals([1000, 2000, 3000, 4000, 0], 1000);
    expect(r.contributorCount).toBe(4);
    expect(r.suppressed).toBe(true);
    expect(r.totalSteps).toBe(0);
  });

  it("marks the target reached only when met and not suppressed", () => {
    const met = computeStepTotals([100, 100, 100, 100, 100], 500);
    expect(met.targetReached).toBe(true);
    const notMet = computeStepTotals([100, 100, 100, 100, 100], 501);
    expect(notMet.targetReached).toBe(false);
  });

  it("floor default matches the product decision (5)", () => {
    expect(STEP_CHALLENGE_MIN_CONTRIBUTORS).toBe(5);
  });
});

describe("optedInPercent", () => {
  it("rounds a fraction of headcount", () => {
    expect(optedInPercent(3, 4)).toBe(75);
    expect(optedInPercent(1, 3)).toBe(33);
  });
  it("is 0 for a zero/absent headcount (no divide-by-zero)", () => {
    expect(optedInPercent(0, 0)).toBe(0);
  });
});

describe("daysRemaining", () => {
  it("counts inclusive days to the end date", () => {
    expect(daysRemaining("2026-10-31", "2026-10-25")).toBe(6);
    expect(daysRemaining("2026-10-31", "2026-10-31")).toBe(0);
  });
  it("is 0 once the end date has passed", () => {
    expect(daysRemaining("2026-10-31", "2026-11-05")).toBe(0);
  });
});

describe("progressPercent", () => {
  it("caps at 100 and floors at 0", () => {
    expect(progressPercent(500, 1000)).toBe(50);
    expect(progressPercent(2000, 1000)).toBe(100);
    expect(progressPercent(0, 1000)).toBe(0);
    expect(progressPercent(100, 0)).toBe(0);
  });
});
