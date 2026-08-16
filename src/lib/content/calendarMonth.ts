// Pure month-grid helpers for the distribution calendar's Month view. No DB, no
// "server-only", no reliance on the current clock (the caller passes the year,
// month and today's ISO date), so they're deterministic and unit-testable —
// see calendarMonth.test.ts. All dates are computed in UTC.

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type MonthCell = {
  /** ISO date, yyyy-mm-dd. */
  iso: string;
  /** Day of month, 1–31. */
  day: number;
  /** False for the leading/trailing days that belong to the adjacent month. */
  inMonth: boolean;
  isToday: boolean;
};

function cell(date: Date, inMonth: boolean, todayIso: string): MonthCell {
  const iso = date.toISOString().slice(0, 10);
  return { iso, day: date.getUTCDate(), inMonth, isToday: iso === todayIso };
}

/**
 * The Monday-first week rows covering `monthIndex` (0 = January) of `year`,
 * padded with the adjacent months' days so every row has 7 cells.
 */
export function buildMonthGrid(year: number, monthIndex: number, todayIso: string): MonthCell[][] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  // getUTCDay: Sun=0..Sat=6 → Monday-first index Mon=0..Sun=6.
  const firstDow = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  const cells: MonthCell[] = [];
  // Leading days from the previous month.
  for (let i = 0; i < firstDow; i++) {
    cells.push(cell(new Date(Date.UTC(year, monthIndex, 1 + i - firstDow)), false, todayIso));
  }
  // This month.
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(cell(new Date(Date.UTC(year, monthIndex, day)), true, todayIso));
  }
  // Trailing days to complete the final week.
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push(cell(new Date(Date.UTC(year, monthIndex + 1, nextDay)), false, todayIso));
    nextDay++;
  }

  const weeks: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** "August 2026". */
export function monthTitle(year: number, monthIndex: number): string {
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

/** The month `delta` months away, normalised across year boundaries. */
export function shiftMonth(year: number, monthIndex: number, delta: number): { year: number; monthIndex: number } {
  const m = monthIndex + delta;
  return { year: year + Math.floor(m / 12), monthIndex: ((m % 12) + 12) % 12 };
}

/** `?month=yyyy-mm` → {year, monthIndex}, or null when absent/invalid. */
export function parseMonthParam(param: string | undefined): { year: number; monthIndex: number } | null {
  if (!param || !/^\d{4}-\d{2}$/.test(param)) return null;
  const [year, month] = param.split("-").map(Number);
  if (month < 1 || month > 12) return null;
  return { year, monthIndex: month - 1 };
}

/** {year, monthIndex} → "yyyy-mm" for building nav links. */
export function monthParam(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}
