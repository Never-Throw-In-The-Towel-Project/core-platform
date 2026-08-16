// Pure date-layout for the calendar's AI Month suggestion. The AI does the
// SEMANTIC part (which weekday theme each draft fits — reusing the week
// proposer); this turns those weekday assignments into concrete publish dates,
// so the AI never has to reason about dates. Deterministic and unit-testable
// (see scheduleLayout.test.ts); all dates in UTC.

function addDaysIso(baseIso: string, days: number): string {
  const d = new Date(`${baseIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Turn weekday assignments (0 = Any day, 1 = Monday … 7 = Sunday) into publish
 * dates on/after `baseIso`:
 *   • a weekday item lands on the next occurrence of that weekday on/after base;
 *     when several items share a weekday they roll onto successive weeks, giving
 *     a natural month-long rollout.
 *   • an "Any day" item fills the earliest days from base, one per day.
 * Collisions are allowed — multiple items may publish on the same date.
 */
export function layOutSchedule(
  assignments: { id: string; day: number }[],
  baseIso: string
): { id: string; date: string }[] {
  const base = new Date(`${baseIso}T00:00:00Z`);
  const baseDow = ((base.getUTCDay() + 6) % 7) + 1; // 1 = Mon … 7 = Sun
  const placedByDay = new Map<number, number>();
  let anyCounter = 0;

  return assignments.map((a) => {
    if (a.day >= 1 && a.day <= 7) {
      const n = placedByDay.get(a.day) ?? 0;
      placedByDay.set(a.day, n + 1);
      const firstDelta = (a.day - baseDow + 7) % 7; // 0–6 days to the next such weekday
      return { id: a.id, date: addDaysIso(baseIso, firstDelta + n * 7) };
    }
    const date = addDaysIso(baseIso, anyCounter);
    anyCounter++;
    return { id: a.id, date };
  });
}
