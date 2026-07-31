import { describe, expect, it } from "vitest";
import {
  getIsoWeekNumber,
  getMondayOfWeek,
  getNextMonday,
  isFirstOccurrenceOfWeekdayInMonth,
  localMinutesSinceMidnight,
  todayISODate,
  weekdayNameOrWeekend,
} from "./dates";

// 2026-08-01 23:30 UTC is already 2026-08-02 (Sunday) in Auckland (UTC+12),
// but still 2026-08-01 (Saturday) in Los Angeles (UTC-7) -- the whole point
// of Phase 9's per-user timezone work is that the same instant can be a
// different calendar day depending on whose timezone resolves it.
const CROSS_MIDNIGHT_INSTANT = new Date("2026-08-01T23:30:00Z");

describe("todayISODate / weekdayNameOrWeekend", () => {
  it("resolves the same instant to different calendar days in different zones", () => {
    expect(todayISODate(CROSS_MIDNIGHT_INSTANT, "UTC")).toBe("2026-08-01");
    expect(weekdayNameOrWeekend(CROSS_MIDNIGHT_INSTANT, "UTC")).toBe("saturday");

    expect(todayISODate(CROSS_MIDNIGHT_INSTANT, "America/Los_Angeles")).toBe("2026-08-01");
    expect(weekdayNameOrWeekend(CROSS_MIDNIGHT_INSTANT, "America/Los_Angeles")).toBe("saturday");

    expect(todayISODate(CROSS_MIDNIGHT_INSTANT, "Pacific/Auckland")).toBe("2026-08-02");
    expect(weekdayNameOrWeekend(CROSS_MIDNIGHT_INSTANT, "Pacific/Auckland")).toBe("sunday");
  });

  it("handles a zone with no DST offset from UTC consistently", () => {
    const januaryMidnightUTC = new Date("2026-01-15T00:05:00Z");
    // Europe/London is GMT (UTC+0) in January -- no shift expected.
    expect(todayISODate(januaryMidnightUTC, "Europe/London")).toBe("2026-01-15");
  });
});

describe("getMondayOfWeek", () => {
  it("returns the Monday that starts the ISO week containing the date", () => {
    // Aug 1 2026 is a Saturday in the ISO week that started Monday Jul 27.
    expect(getMondayOfWeek(CROSS_MIDNIGHT_INSTANT, "UTC")).toBe("2026-07-27");
    // Aug 2 2026 (Auckland's local date for the same instant) is a Sunday --
    // the *last* day of that same ISO week, so still Jul 27.
    expect(getMondayOfWeek(CROSS_MIDNIGHT_INSTANT, "Pacific/Auckland")).toBe("2026-07-27");
  });
});

describe("getNextMonday", () => {
  it("returns the Monday of the following week", () => {
    expect(getNextMonday(CROSS_MIDNIGHT_INSTANT, "Europe/London")).toBe("2026-08-03");
  });
});

describe("getIsoWeekNumber", () => {
  it("returns a stable week number for a fixed zone", () => {
    expect(getIsoWeekNumber(CROSS_MIDNIGHT_INSTANT, "UTC")).toBe(31);
  });
});

describe("isFirstOccurrenceOfWeekdayInMonth", () => {
  it("is true only for the first matching weekday in the month", () => {
    const firstTuesday = new Date("2026-08-04T10:00:00Z");
    const secondTuesday = new Date("2026-08-11T10:00:00Z");
    expect(isFirstOccurrenceOfWeekdayInMonth(firstTuesday, "UTC", "tuesday")).toBe(true);
    expect(isFirstOccurrenceOfWeekdayInMonth(secondTuesday, "UTC", "tuesday")).toBe(false);
  });

  it("is false for a different weekday even in the first week", () => {
    const firstTuesday = new Date("2026-08-04T10:00:00Z");
    expect(isFirstOccurrenceOfWeekdayInMonth(firstTuesday, "UTC", "wednesday")).toBe(false);
  });
});

describe("localMinutesSinceMidnight", () => {
  it("computes minutes since local midnight for a fixed zone", () => {
    // 10:15 UTC is 615 minutes since midnight.
    const instant = new Date("2026-08-04T10:15:00Z");
    expect(localMinutesSinceMidnight(instant, "UTC")).toBe(615);
  });

  it("resolves differently across zones for the same instant", () => {
    // Same instant as above, but Auckland (UTC+12) is 12 hours ahead --
    // 22:15 local, 1335 minutes since its own midnight.
    const instant = new Date("2026-08-04T10:15:00Z");
    expect(localMinutesSinceMidnight(instant, "Pacific/Auckland")).toBe(22 * 60 + 15);
  });
});
