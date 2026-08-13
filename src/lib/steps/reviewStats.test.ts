import { describe, it, expect } from "vitest";
import { averageDailySteps, stepsStatForRange, addDaysIso } from "./reviewStats";

describe("averageDailySteps", () => {
  it("returns null when nothing is logged (so the metric can be hidden, not shown as 0)", () => {
    expect(averageDailySteps([])).toBeNull();
  });

  it("averages over the logged days only and rounds to a whole number", () => {
    expect(averageDailySteps([{ steps: 10000 }, { steps: 5000 }])).toBe(7500);
    // (10000 + 5001 + 4000) / 3 = 6333.67 -> 6334
    expect(averageDailySteps([{ steps: 10000 }, { steps: 5001 }, { steps: 4000 }])).toBe(6334);
  });

  it("counts a logged zero-step day as a logged day", () => {
    expect(averageDailySteps([{ steps: 0 }, { steps: 10000 }])).toBe(5000);
  });
});

describe("stepsStatForRange", () => {
  const entries = [
    { entry_date: "2026-01-01", steps: 1000 },
    { entry_date: "2026-01-15", steps: 3000 },
    { entry_date: "2026-01-31", steps: 5000 },
    { entry_date: "2026-02-05", steps: 9000 },
  ];

  it("includes both range boundaries and excludes dates outside them", () => {
    const stat = stepsStatForRange(entries, "2026-01-01", "2026-01-31");
    expect(stat.daysLogged).toBe(3);
    expect(stat.averageDailySteps).toBe(3000); // (1000+3000+5000)/3
  });

  it("returns a null average and zero days when the range has no entries", () => {
    const stat = stepsStatForRange(entries, "2026-03-01", "2026-03-31");
    expect(stat).toEqual({ daysLogged: 0, averageDailySteps: null });
  });

  it("narrows to a sub-window (first 30 days)", () => {
    const stat = stepsStatForRange(entries, "2026-01-01", "2026-01-30");
    expect(stat.daysLogged).toBe(2); // 01-01 and 01-15, not 01-31
    expect(stat.averageDailySteps).toBe(2000);
  });
});

describe("addDaysIso", () => {
  it("offset 0 returns the same date", () => {
    expect(addDaysIso("2026-01-01", 0)).toBe("2026-01-01");
  });

  it("adds days across a month boundary without shifting via timezone", () => {
    expect(addDaysIso("2026-01-01", 29)).toBe("2026-01-30");
    expect(addDaysIso("2026-01-15", 30)).toBe("2026-02-14");
  });
});
