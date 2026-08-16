import { describe, it, expect } from "vitest";
import { buildMonthGrid, monthTitle, shiftMonth, parseMonthParam, monthParam } from "./calendarMonth";

describe("buildMonthGrid", () => {
  // August 2026: the 1st falls on a Saturday.
  const weeks = buildMonthGrid(2026, 7, "2026-08-16");

  it("lays out Monday-first weeks of 7 cells each", () => {
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    // First row starts on the Monday before the 1st (Mon 27 Jul).
    expect(weeks[0][0].iso).toBe("2026-07-27");
    expect(weeks[0][0].inMonth).toBe(false);
  });

  it("places the 1st in the right weekday column (Sat)", () => {
    // Mon=0 … Sat=5.
    expect(weeks[0][5].iso).toBe("2026-08-01");
    expect(weeks[0][5].day).toBe(1);
    expect(weeks[0][5].inMonth).toBe(true);
  });

  it("covers all of the month and flags today", () => {
    const inMonth = weeks.flat().filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(31);
    expect(inMonth[0].iso).toBe("2026-08-01");
    expect(inMonth[30].iso).toBe("2026-08-31");
    const today = weeks.flat().find((c) => c.isToday);
    expect(today?.iso).toBe("2026-08-16");
  });

  it("handles a December→January year boundary in the trailing days", () => {
    const dec = buildMonthGrid(2026, 11, "2026-12-01");
    const last = dec.flat().filter((c) => c.inMonth).at(-1);
    expect(last?.iso).toBe("2026-12-31");
    // Trailing cells roll into January 2027.
    const trailing = dec.flat().filter((c) => !c.inMonth && c.iso > "2026-12-31");
    expect(trailing[0]?.iso).toBe("2027-01-01");
  });
});

describe("monthTitle / shiftMonth / parseMonthParam / monthParam", () => {
  it("titles a month", () => {
    expect(monthTitle(2026, 7)).toBe("August 2026");
  });

  it("shifts across year boundaries", () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, monthIndex: 11 });
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, monthIndex: 0 });
    expect(shiftMonth(2026, 5, 0)).toEqual({ year: 2026, monthIndex: 5 });
  });

  it("round-trips the month param", () => {
    expect(monthParam(2026, 7)).toBe("2026-08");
    expect(parseMonthParam("2026-08")).toEqual({ year: 2026, monthIndex: 7 });
  });

  it("rejects a bad month param", () => {
    expect(parseMonthParam(undefined)).toBeNull();
    expect(parseMonthParam("2026-13")).toBeNull();
    expect(parseMonthParam("nonsense")).toBeNull();
  });
});
