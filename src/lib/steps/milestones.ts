// Pure step-milestone helpers -- no DB, no "server-only", unit-testable
// (see milestones.test.ts). They reduce a member's own step history to the two
// MONOTONIC figures the step badges evaluate against (brief §3):
//   - 10K Club       -> a single 10,000-step day ever happened
//   - Week Streak    -> a run of 7 consecutive logged days ever happened
//   - 30 Day Mover   -> a run of 30 consecutive logged days ever happened
// Both figures only ever grow (a best-ever max, a best-ever streak), so a badge
// earned from them can never later un-earn -- consistent with the revoke-proof
// `earned_badges` store. A "logged day" is simply any day with a step entry
// (the value can be anything, including 0); presence is what counts.

/** Highest steps recorded on any single day; 0 when nothing is logged. */
export function maxSingleDaySteps(entries: { steps: number }[]): number {
  return entries.reduce((max, e) => (e.steps > max ? e.steps : max), 0);
}

/**
 * The longest run of consecutive calendar days that each have a logged step
 * entry. Input dates may be unsorted and contain duplicates; both are handled.
 * Returns 0 for no dates, 1 for isolated days.
 */
export function bestStepLoggingStreak(dates: string[]): number {
  const unique = Array.from(new Set(dates)).sort();
  if (unique.length === 0) return 0;

  let best = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(`${unique[i - 1]}T00:00:00Z`).getTime();
    const cur = new Date(`${unique[i]}T00:00:00Z`).getTime();
    if (cur - prev === 86_400_000) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }
  return best;
}
