import { describe, expect, it } from "vitest";
import {
  catchUpEligibleWeekdays,
  getIsoWeekNumber,
  getMondayOfWeek,
  getNextMonday,
  isFirstOccurrenceOfWeekdayInMonth,
  isFirstWeekdayOfMonthInWeek,
  localMinutesSinceMidnight,
  recentUtcDates,
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

describe("isFirstWeekdayOfMonthInWeek", () => {
  // 2026-08-04 is the first Tuesday of August; 2026-08-06 is the Thursday of
  // that same week; 2026-08-11 is the second Tuesday; 2026-08-13 its Thursday.
  it("is true on the first Tuesday itself", () => {
    expect(isFirstWeekdayOfMonthInWeek(new Date("2026-08-04T10:00:00Z"), "UTC", "tuesday")).toBe(true);
  });

  it("is STILL true later the same week (the catch-up case the old check missed)", () => {
    // Opening Tuesday's check-in on Thursday must not suppress the monthly
    // podcast: this week's Tuesday (Aug 4) is genuinely the first of the month.
    expect(isFirstWeekdayOfMonthInWeek(new Date("2026-08-06T10:00:00Z"), "UTC", "tuesday")).toBe(true);
  });

  it("is false in a week whose Tuesday is the second of the month", () => {
    expect(isFirstWeekdayOfMonthInWeek(new Date("2026-08-11T10:00:00Z"), "UTC", "tuesday")).toBe(false);
    expect(isFirstWeekdayOfMonthInWeek(new Date("2026-08-13T10:00:00Z"), "UTC", "tuesday")).toBe(false);
  });
});

describe("catchUpEligibleWeekdays", () => {
  it("includes only Monday through today when today is a mid-week weekday", () => {
    // 2026-08-05 is a Wednesday.
    const wednesday = new Date("2026-08-05T10:00:00Z");
    expect(catchUpEligibleWeekdays(wednesday, "UTC")).toEqual(["monday", "tuesday", "wednesday"]);
  });

  it("never includes a day later in the week than today", () => {
    const monday = new Date("2026-08-03T10:00:00Z");
    expect(catchUpEligibleWeekdays(monday, "UTC")).toEqual(["monday"]);
  });

  it("includes the full Mon-Fri set once the weekend arrives, and no further", () => {
    const saturday = new Date("2026-08-08T10:00:00Z");
    const sunday = new Date("2026-08-09T10:00:00Z");
    expect(catchUpEligibleWeekdays(saturday, "UTC")).toEqual([
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
    ]);
    expect(catchUpEligibleWeekdays(sunday, "UTC")).toEqual([
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
    ]);
  });

  it("resolves per the caller's timezone, same as weekdayNameOrWeekend", () => {
    // 2026-08-01 23:30 UTC is Saturday in UTC but already Sunday in Auckland.
    const instant = new Date("2026-08-01T23:30:00Z");
    expect(catchUpEligibleWeekdays(instant, "UTC")).toHaveLength(5);
    expect(catchUpEligibleWeekdays(instant, "Pacific/Auckland")).toHaveLength(5);
  });
});

describe("recentUtcDates", () => {
  it("returns `count` fully-elapsed UTC days ending at yesterday-UTC, oldest first", () => {
    // Run at 02:00 UTC (the real cron time): yesterday-UTC is Aug 9, and the
    // window reaches back three days -- Aug 7, 8, 9.
    const runInstant = new Date("2026-08-10T02:00:00Z");
    expect(recentUtcDates(runInstant, 3)).toEqual(["2026-08-07", "2026-08-08", "2026-08-09"]);
  });

  it("never includes today-UTC (the day that isn't settled for anyone yet)", () => {
    const runInstant = new Date("2026-08-10T02:00:00Z");
    const dates = recentUtcDates(runInstant, 3);
    expect(dates).not.toContain("2026-08-10");
    expect(dates[dates.length - 1]).toBe("2026-08-09");
  });

  it("uses UTC to pick the window even late in the UTC day", () => {
    // 23:59 UTC is still Aug 10 in UTC, so yesterday-UTC is Aug 9 -- the
    // window is UTC-based, matching the rest of the cron-side date math.
    const runInstant = new Date("2026-08-10T23:59:00Z");
    expect(recentUtcDates(runInstant, 1)).toEqual(["2026-08-09"]);
  });

  it("rolls back across a month boundary", () => {
    const runInstant = new Date("2026-09-01T02:00:00Z");
    expect(recentUtcDates(runInstant, 3)).toEqual(["2026-08-29", "2026-08-30", "2026-08-31"]);
  });

  it("re-covers a day long enough for the westmost zones to settle", () => {
    // A day D is fully over in every timezone within ~26h of UTC midnight, so
    // the run two days later (D+2) sees D closed everywhere. With a 3-day
    // window, D is re-aggregated on the D+1, D+2 and D+3 runs -- the D+2 pass
    // alone already guarantees a fully-settled recount.
    const dPlus2Run = new Date("2026-08-12T02:00:00Z");
    expect(recentUtcDates(dPlus2Run, 3)).toContain("2026-08-10");
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
