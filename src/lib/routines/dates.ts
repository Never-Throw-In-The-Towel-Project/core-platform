import type { Weekday } from "@/types/database";

// All date arithmetic here is UTC-based. There is no per-user timezone
// column yet (see docs/ARCHITECTURE.md open items) -- this is a known
// simplification, not a guess at a design we haven't made: it means a user
// near a date boundary could see their "morning" flip over at a UTC-relative
// time rather than their local midday/7pm. Revisit once profiles carries a
// timezone.

export function todayISODate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export type WeekdayOrWeekend = Weekday | "saturday" | "sunday";

const UTC_DAY_TO_NAME: WeekdayOrWeekend[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function weekdayNameOrWeekend(now: Date = new Date()): WeekdayOrWeekend {
  return UTC_DAY_TO_NAME[now.getUTCDay()];
}

/** Monday of the calendar week containing `now`, as an ISO date string. */
export function getMondayOfWeek(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const isoDayNum = d.getUTCDay() || 7; // Mon=1 .. Sun=7
  d.setUTCDate(d.getUTCDate() - isoDayNum + 1);
  return todayISODate(d);
}

/** The Monday of the week *after* `now`'s week -- what Sunday Setup preps for. */
export function getNextMonday(now: Date = new Date()): string {
  const monday = new Date(getMondayOfWeek(now) + "T00:00:00Z");
  monday.setUTCDate(monday.getUTCDate() + 7);
  return todayISODate(monday);
}

/** ISO-8601 week number (1-53), used to key the rotating content banks. */
export function getIsoWeekNumber(now: Date = new Date()): number {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const isoDayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - isoDayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Maps a 1-based ISO week number onto a fixed-size rotating content bank. */
export function resolveBankPosition(isoWeek: number, bankSize: number): number {
  return ((isoWeek - 1) % bankSize) + 1;
}

export function isFirstOccurrenceOfWeekdayInMonth(now: Date, weekday: WeekdayOrWeekend): boolean {
  return weekdayNameOrWeekend(now) === weekday && now.getUTCDate() <= 7;
}
