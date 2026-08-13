import { describe, it, expect } from "vitest";
import { lastNDates, buildStepsWeek } from "./week";

describe("lastNDates", () => {
  it("returns n dates ending at today, oldest first", () => {
    expect(lastNDates("2026-08-13", 3)).toEqual(["2026-08-11", "2026-08-12", "2026-08-13"]);
  });

  it("returns just today for n=1", () => {
    expect(lastNDates("2026-08-13", 1)).toEqual(["2026-08-13"]);
  });

  it("crosses a month boundary correctly", () => {
    expect(lastNDates("2026-09-01", 2)).toEqual(["2026-08-31", "2026-09-01"]);
  });
});

describe("buildStepsWeek", () => {
  it("fills missing days with 0 and preserves date order", () => {
    const dates = ["2026-08-11", "2026-08-12", "2026-08-13"];
    const entries = [
      { entry_date: "2026-08-13", steps: 8000 },
      { entry_date: "2026-08-11", steps: 3000 },
    ];
    expect(buildStepsWeek(dates, entries)).toEqual([
      { date: "2026-08-11", steps: 3000 },
      { date: "2026-08-12", steps: 0 },
      { date: "2026-08-13", steps: 8000 },
    ]);
  });

  it("ignores entries outside the date window", () => {
    const dates = ["2026-08-12", "2026-08-13"];
    const entries = [{ entry_date: "2026-08-01", steps: 9999 }];
    expect(buildStepsWeek(dates, entries)).toEqual([
      { date: "2026-08-12", steps: 0 },
      { date: "2026-08-13", steps: 0 },
    ]);
  });

  it("returns an empty array for no dates", () => {
    expect(buildStepsWeek([], [{ entry_date: "2026-08-13", steps: 5000 }])).toEqual([]);
  });
});
