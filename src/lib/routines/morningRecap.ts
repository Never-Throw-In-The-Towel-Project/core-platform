// Pure, side-effect-free: shape the week's morning entries into the Saturday
// Weekly Review's read-only "Your own routines this week" recap. No "server-only"
// import, so it's unit-testable (same discipline as checkinPrefill.ts). Rows are
// read defensively by column name, so a shape surprise is skipped, not thrown.

export type MorningRecapItem = { date: string; weekday: string; note: string };

const WEEKDAY_BY_UTC_DAY = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** The weekday name for a YYYY-MM-DD date (read at UTC midnight, matching how the
 *  date was stored — a civil date, not an instant). */
function weekdayLabel(isoDate: string): string {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return WEEKDAY_BY_UTC_DAY[day] ?? "";
}

/**
 * The week's non-empty "my own routines today" morning notes, oldest day first.
 * Blank / whitespace-only notes are dropped so the recap only shows days the
 * member actually recorded something.
 */
export function toWeekMorningRecap(
  rows: { entry_date?: unknown; extra_routines?: unknown }[] | null | undefined
): MorningRecapItem[] {
  return (rows ?? [])
    .map((r) => ({
      date: typeof r.entry_date === "string" ? r.entry_date : "",
      note: typeof r.extra_routines === "string" ? r.extra_routines.trim() : "",
    }))
    .filter((r) => r.date !== "" && r.note !== "")
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((r) => ({ date: r.date, weekday: weekdayLabel(r.date), note: r.note }));
}
