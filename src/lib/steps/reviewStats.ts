// Pure step-review helpers -- no DB access and no "server-only", so they are
// unit-testable in isolation (see reviewStats.test.ts). Dates are ISO
// "YYYY-MM-DD" strings; all arithmetic is UTC calendar math on the date-only
// string, so it never shifts a day. These power the "average daily steps"
// figure the 30/90-day reviews show (brief §1): a purely personal, never-
// reportable metric derived only from the member's own `step_entries`.

export interface StepsReviewStat {
  /** How many days in the range actually have a logged step entry. */
  daysLogged: number;
  /**
   * Mean steps *over the days that were logged* -- not over every calendar
   * day. Averaging over logged days (rather than treating un-logged days as 0)
   * is deliberate: steps are optional, so a member who logs three days a week
   * still sees a truthful "on the days you logged" figure rather than one
   * dragged toward zero for not tracking. `null` when nothing was logged, so
   * the caller can hide the metric entirely rather than show a misleading 0.
   */
  averageDailySteps: number | null;
}

export function averageDailySteps(entries: { steps: number }[]): number | null {
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, e) => sum + e.steps, 0);
  return Math.round(total / entries.length);
}

/** Average over entries whose `entry_date` falls within [startIso, endIso], inclusive. */
export function stepsStatForRange(
  entries: { entry_date: string; steps: number }[],
  startIso: string,
  endIso: string
): StepsReviewStat {
  const inRange = entries.filter((e) => e.entry_date >= startIso && e.entry_date <= endIso);
  return { daysLogged: inRange.length, averageDailySteps: averageDailySteps(inRange) };
}

/**
 * The ISO date `days` after `startIso` (0 -> startIso itself). Used to carve
 * the "first 30 days" window out of a 90-day review period for the physical-
 * progress comparison, mirroring how the mindset self-assessment compares the
 * 90-day scores against the 30-day ones.
 */
export function addDaysIso(startIso: string, days: number): string {
  const d = new Date(`${startIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
