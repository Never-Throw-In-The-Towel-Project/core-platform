import { describe, it, expect } from "vitest";
import {
  cleanDates,
  longestCleanStreak,
  currentCleanStreak,
  computeHabitProgress,
} from "./progress";

const mark = (date: string, outcome: "success" | "slip" = "success") => ({ check_in_date: date, outcome });

describe("cleanDates", () => {
  it("returns only the success dates", () => {
    const marks = [mark("2026-08-10"), mark("2026-08-11", "slip"), mark("2026-08-12")];
    expect(cleanDates(marks)).toEqual(["2026-08-10", "2026-08-12"]);
  });
});

describe("longestCleanStreak", () => {
  it("is 0 for none, 1 for isolated", () => {
    expect(longestCleanStreak([])).toBe(0);
    expect(longestCleanStreak(["2026-08-10"])).toBe(1);
  });
  it("finds the longest consecutive run, unsorted + deduped", () => {
    expect(longestCleanStreak(["2026-08-12", "2026-08-10", "2026-08-11", "2026-08-11"])).toBe(3);
  });
  it("breaks the run on a gap", () => {
    expect(longestCleanStreak(["2026-08-10", "2026-08-11", "2026-08-14", "2026-08-15"])).toBe(2);
  });
  it("handles month boundaries", () => {
    expect(longestCleanStreak(["2026-07-31", "2026-08-01", "2026-08-02"])).toBe(3);
  });
});

describe("currentCleanStreak (non-punitive today grace)", () => {
  it("counts consecutive days ending today when today is marked", () => {
    expect(currentCleanStreak(["2026-08-18", "2026-08-19", "2026-08-20"], "2026-08-20")).toBe(3);
  });
  it("does NOT break just because today isn't marked yet (counts from yesterday)", () => {
    expect(currentCleanStreak(["2026-08-18", "2026-08-19"], "2026-08-20")).toBe(2);
  });
  it("is 0 when neither today nor yesterday is clean (a real gap ended it)", () => {
    expect(currentCleanStreak(["2026-08-10", "2026-08-11"], "2026-08-20")).toBe(0);
  });
  it("an explicit slip TODAY ends the run (no yesterday grace)", () => {
    // clean 18 + 19, but today (20) was logged as a slip -> streak is 0, not 2.
    expect(currentCleanStreak(["2026-08-18", "2026-08-19"], "2026-08-20", true)).toBe(0);
  });
  it("today clean still counts even if todaySlipped is (contradictorily) passed", () => {
    // today is in the clean set, so it's counted regardless of the slip flag.
    expect(currentCleanStreak(["2026-08-19", "2026-08-20"], "2026-08-20", true)).toBe(2);
  });
});

describe("computeHabitProgress", () => {
  it("counts clean days toward the goal; a slip never subtracts", () => {
    const marks = [mark("2026-08-10"), mark("2026-08-11", "slip"), mark("2026-08-12"), mark("2026-08-13")];
    const p = computeHabitProgress(7, marks, "2026-08-13");
    expect(p.cleanDays).toBe(3);
    expect(p.slipDays).toBe(1);
    expect(p.remaining).toBe(4);
    expect(p.percent).toBe(42); // floor(3/7*100), not round
    expect(p.isComplete).toBe(false);
    expect(p.longestStreak).toBe(2); // 12 + 13 (11 was a slip)
  });

  it("never shows 100% until the goal is actually reached (floor, not round)", () => {
    // 199/200 = 99.5 -> round would read 100% while still incomplete; floor = 99.
    const marks = Array.from({ length: 199 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
      return mark(d);
    });
    const p = computeHabitProgress(200, marks, "2026-08-20");
    expect(p.cleanDays).toBe(199);
    expect(p.percent).toBe(99);
    expect(p.isComplete).toBe(false);
  });

  it("a slip logged for today breaks the current streak", () => {
    const marks = [mark("2026-08-18"), mark("2026-08-19"), mark("2026-08-20", "slip")];
    const p = computeHabitProgress(30, marks, "2026-08-20");
    expect(p.cleanDays).toBe(2); // the count of clean days is untouched
    expect(p.currentStreak).toBe(0); // but the run ended today
    expect(p.longestStreak).toBe(2); // best-ever run is preserved
  });

  it("completes at target clean days and caps percent at 100", () => {
    const marks = ["2026-08-10", "2026-08-11", "2026-08-12"].map((d) => mark(d));
    const p = computeHabitProgress(3, marks, "2026-08-12");
    expect(p.isComplete).toBe(true);
    expect(p.remaining).toBe(0);
    expect(p.percent).toBe(100);
    expect(p.currentStreak).toBe(3);
  });
});
