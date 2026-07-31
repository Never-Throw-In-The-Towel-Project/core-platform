import type { Weekday } from "@/types/database";

// Every function here takes an explicit IANA `timeZone` -- no default, on
// purpose. Phase 1-3 had a real bug (see docs/ARCHITECTURE.md "Privacy
// boundary") caused by a schema parameter that silently defaulted to the
// wrong value at forgotten call sites; a timezone parameter is the same
// shape of risk (a user near a date boundary silently gets the wrong
// "today"), so this one has no default -- every call site must say
// explicitly which zone it means. User-facing call sites pass the caller's
// own `profile.timezone`; system/cross-user call sites (the aggregation
// cron job, the HR PDF report) pass `"UTC"` explicitly, since those define
// a single company-wide notion of "day"/"week" for bucketing many users'
// data at once -- not any one user's local day. See "Per-user timezone
// (Phase 9)" in docs/ARCHITECTURE.md.

export type TimeZone = string;

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: WeekdayOrWeekend;
};

const WEEKDAY_ABBR_TO_NAME: Record<string, WeekdayOrWeekend> = {
  Sun: "sunday",
  Mon: "monday",
  Tue: "tuesday",
  Wed: "wednesday",
  Thu: "thursday",
  Fri: "friday",
  Sat: "saturday",
};

/** The calendar date/hour/weekday `now` falls on, as observed in `timeZone`. */
function zonedParts(now: Date, timeZone: TimeZone): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(formatter.formatToParts(now).map((p) => [p.type, p.value]));

  // Some environments report midnight as hour "24" under hour12:false.
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    weekday: WEEKDAY_ABBR_TO_NAME[parts.weekday],
  };
}

/** Formats an already-zone-resolved civil date (a UTC-anchored "floating" Date) as YYYY-MM-DD. */
function civilDateToISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayISODate(now: Date, timeZone: TimeZone): string {
  const { year, month, day } = zonedParts(now, timeZone);
  return civilDateToISO(new Date(Date.UTC(year, month - 1, day)));
}

/** The hour of day (0-23) `now` falls on in `timeZone` -- drives the home-screen phase cutovers. */
export function localHour(now: Date, timeZone: TimeZone): number {
  return zonedParts(now, timeZone).hour;
}

/** Minutes since local midnight (0-1439) `now` falls on in `timeZone` -- drives push notification scheduling. */
export function localMinutesSinceMidnight(now: Date, timeZone: TimeZone): number {
  const { hour, minute } = zonedParts(now, timeZone);
  return hour * 60 + minute;
}

export type WeekdayOrWeekend = Weekday | "saturday" | "sunday";

export function weekdayNameOrWeekend(now: Date, timeZone: TimeZone): WeekdayOrWeekend {
  return zonedParts(now, timeZone).weekday;
}

/** Monday of the calendar week containing `now` in `timeZone`, as an ISO date string. */
export function getMondayOfWeek(now: Date, timeZone: TimeZone): string {
  const { year, month, day } = zonedParts(now, timeZone);
  const d = new Date(Date.UTC(year, month - 1, day));
  const isoDayNum = d.getUTCDay() || 7; // Mon=1 .. Sun=7
  d.setUTCDate(d.getUTCDate() - isoDayNum + 1);
  return civilDateToISO(d);
}

/** The Monday of the week *after* `now`'s week -- what Sunday Setup preps for. */
export function getNextMonday(now: Date, timeZone: TimeZone): string {
  const monday = new Date(getMondayOfWeek(now, timeZone) + "T00:00:00Z");
  monday.setUTCDate(monday.getUTCDate() + 7);
  return civilDateToISO(monday);
}

/** ISO-8601 week number (1-53), used to key the rotating content banks. */
export function getIsoWeekNumber(now: Date, timeZone: TimeZone): number {
  const { year, month, day } = zonedParts(now, timeZone);
  const d = new Date(Date.UTC(year, month - 1, day));
  const isoDayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - isoDayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Maps a 1-based ISO week number onto a fixed-size rotating content bank. */
export function resolveBankPosition(isoWeek: number, bankSize: number): number {
  return ((isoWeek - 1) % bankSize) + 1;
}

export function isFirstOccurrenceOfWeekdayInMonth(
  now: Date,
  timeZone: TimeZone,
  weekday: WeekdayOrWeekend
): boolean {
  const parts = zonedParts(now, timeZone);
  return parts.weekday === weekday && parts.day <= 7;
}
