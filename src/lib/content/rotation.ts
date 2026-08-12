// Pure content-rotation helpers -- no DB access and no "server-only", so they
// are unit-testable in isolation (see rotation.test.ts). The day-of-week
// carousel uses these to serve a different item from a day's bank each real
// ISO week -- the "different Monday every Monday" behaviour from
// docs/CONTENT_PLATFORM_STRATEGY.md.

import type { WeekdayOrWeekend } from "@/lib/routines/dates";

const ISO_BY_WEEKDAY: Record<WeekdayOrWeekend, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

/** ISO weekday number (1 = Monday … 7 = Sunday) for a weekday name. */
export function isoWeekdayFromName(name: WeekdayOrWeekend): number {
  return ISO_BY_WEEKDAY[name];
}

export const DAY_LABEL: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

/**
 * Rotate a day's content bank so a different item leads each real ISO week.
 * Deterministic (the same week always yields the same order) and fair (every
 * item eventually leads as the weeks advance), mirroring the ISO-week bank
 * rotation the workout/quote banks already use (resolveBankPosition in
 * lib/routines/dates.ts) so every member in a channel sees the same pick in
 * the same real week. `isoWeekNumber` is 1-based (see getIsoWeekNumber).
 */
export function rotateForWeek<T>(items: readonly T[], isoWeekNumber: number): T[] {
  const n = items.length;
  if (n <= 1) return [...items];
  const offset = (((isoWeekNumber - 1) % n) + n) % n;
  return [...items.slice(offset), ...items.slice(0, offset)];
}
