import { describe, it, expect } from "vitest";
import { toWeekMorningRecap } from "./morningRecap";

// 2026-11-09 is a Monday, -11 a Wednesday, -14 a Saturday.
describe("toWeekMorningRecap", () => {
  it("keeps only non-empty notes, oldest day first, with weekday labels", () => {
    const rows = [
      { entry_date: "2026-11-11", extra_routines: "20 min run" },
      { entry_date: "2026-11-09", extra_routines: "  cold shower  " }, // trimmed
      { entry_date: "2026-11-10", extra_routines: "" }, // dropped (empty)
      { entry_date: "2026-11-12", extra_routines: "   " }, // dropped (whitespace)
    ];
    expect(toWeekMorningRecap(rows)).toEqual([
      { date: "2026-11-09", weekday: "Monday", note: "cold shower" },
      { date: "2026-11-11", weekday: "Wednesday", note: "20 min run" },
    ]);
  });

  it("returns [] for null/empty input and skips malformed rows", () => {
    expect(toWeekMorningRecap(null)).toEqual([]);
    expect(toWeekMorningRecap([])).toEqual([]);
    expect(toWeekMorningRecap([{ extra_routines: "no date" }, { entry_date: 123 }])).toEqual([]);
  });
});
