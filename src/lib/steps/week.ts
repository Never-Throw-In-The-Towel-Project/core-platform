// Pure step-history helpers -- no DB access and no "server-only", so they are
// unit-testable in isolation (see week.test.ts) and safe to import from the
// client StepsCard. Dates are ISO "YYYY-MM-DD" strings in the member's own
// timezone (computed by the caller); this file does no timezone maths of its
// own, only calendar arithmetic on a fixed date string.

export interface StepDay {
  /** ISO date "YYYY-MM-DD". */
  date: string;
  /** Steps logged that day; 0 when nothing was logged. */
  steps: number;
}

/**
 * The `n` ISO dates ending at (and including) `todayIso`, oldest first.
 * lastNDates("2026-08-13", 3) -> ["2026-08-11", "2026-08-12", "2026-08-13"].
 * Uses UTC arithmetic on the date-only string, so it never shifts a day.
 */
export function lastNDates(todayIso: string, n: number): string[] {
  const end = new Date(`${todayIso}T00:00:00Z`);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Line up logged step entries against a run of dates: one StepDay per date, in
 * date order, with steps = 0 for any day with no entry. Pure. Extra entries
 * whose date isn't in `dates` are ignored (the caller decides the window).
 */
export function buildStepsWeek(dates: string[], entries: { entry_date: string; steps: number }[]): StepDay[] {
  const byDate = new Map<string, number>();
  for (const entry of entries) {
    byDate.set(entry.entry_date, entry.steps);
  }
  return dates.map((date) => ({ date, steps: byDate.get(date) ?? 0 }));
}
