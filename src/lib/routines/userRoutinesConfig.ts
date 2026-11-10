// Pure, client-safe config for My Routines — shared by the composer/edit form,
// the manage list and the Today card. No side effects, no server-only imports,
// so the client components and the server reads use one source of truth.

export const ROUTINE_WEEKDAYS = [
  { iso: 1, short: "Mon", label: "Monday" },
  { iso: 2, short: "Tue", label: "Tuesday" },
  { iso: 3, short: "Wed", label: "Wednesday" },
  { iso: 4, short: "Thu", label: "Thursday" },
  { iso: 5, short: "Fri", label: "Friday" },
  { iso: 6, short: "Sat", label: "Saturday" },
  { iso: 7, short: "Sun", label: "Sunday" },
] as const;

/** A stored time ("HH:MM:SS" | "HH:MM" | null) → "HH:MM" | null for display/inputs. */
export function formatRoutineTime(time: string | null | undefined): string | null {
  if (!time) return null;
  return time.slice(0, 5);
}

/** Render a weekdays set (ISO 1..7) as a compact human summary for the list. */
export function summariseWeekdays(weekdays: number[]): string {
  const set = new Set(weekdays);
  if (set.size === 7) return "Every day";
  if ([1, 2, 3, 4, 5].every((d) => set.has(d)) && !set.has(6) && !set.has(7)) return "Weekdays";
  if (set.size === 2 && set.has(6) && set.has(7)) return "Weekends";
  return ROUTINE_WEEKDAYS.filter((w) => set.has(w.iso))
    .map((w) => w.short)
    .join(", ");
}
