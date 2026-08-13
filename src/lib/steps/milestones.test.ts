import { describe, it, expect } from "vitest";
import { maxSingleDaySteps, bestStepLoggingStreak } from "./milestones";

describe("maxSingleDaySteps", () => {
  it("is 0 when nothing is logged", () => {
    expect(maxSingleDaySteps([])).toBe(0);
  });

  it("returns the single highest day", () => {
    expect(maxSingleDaySteps([{ steps: 3000 }, { steps: 10200 }, { steps: 8000 }])).toBe(10200);
  });
});

describe("bestStepLoggingStreak", () => {
  it("is 0 for no days and 1 for a single isolated day", () => {
    expect(bestStepLoggingStreak([])).toBe(0);
    expect(bestStepLoggingStreak(["2026-01-10"])).toBe(1);
  });

  it("counts the longest consecutive run, not the total number of days", () => {
    // two runs: 01-01..01-03 (3) and 01-10..01-11 (2)
    const dates = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-10", "2026-01-11"];
    expect(bestStepLoggingStreak(dates)).toBe(3);
  });

  it("handles unsorted input and duplicates", () => {
    const dates = ["2026-01-03", "2026-01-01", "2026-01-02", "2026-01-02"];
    expect(bestStepLoggingStreak(dates)).toBe(3);
  });

  it("counts a clean 7-day week and a full 30-day run across month boundaries", () => {
    const week: string[] = [];
    for (let d = 1; d <= 7; d++) week.push(`2026-01-0${d}`);
    expect(bestStepLoggingStreak(week)).toBe(7);

    const month: string[] = [];
    const start = new Date("2026-01-20T00:00:00Z");
    for (let i = 0; i < 30; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      month.push(d.toISOString().slice(0, 10));
    }
    expect(bestStepLoggingStreak(month)).toBe(30); // spans Jan 20 -> Feb 18
  });

  it("breaks the run when a day is missing", () => {
    const dates = ["2026-01-01", "2026-01-02", "2026-01-04", "2026-01-05", "2026-01-06"];
    expect(bestStepLoggingStreak(dates)).toBe(3); // 01-04..01-06
  });
});
