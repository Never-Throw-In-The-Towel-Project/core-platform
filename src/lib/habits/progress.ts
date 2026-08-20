// Pure Clean Streak progress helpers -- no DB, no "server-only", unit-testable
// (see progress.test.ts). Non-punitive by design: progress is the COUNT of clean
// days toward the goal (a slip never subtracts). Streaks are surfaced only to
// celebrate, never to gate completion.

import type { HabitCheckInOutcome } from "@/types/database";

type DayMark = { outcome: HabitCheckInOutcome; check_in_date: string };

const DAY_MS = 86_400_000;

function dayUtc(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getTime();
}

/** The dates (yyyy-mm-dd) a member marked CLEAN. */
export function cleanDates(checkIns: DayMark[]): string[] {
  return checkIns.filter((c) => c.outcome === "success").map((c) => c.check_in_date);
}

/**
 * The longest run of consecutive calendar days marked clean. Input may be
 * unsorted and contain duplicates; both are handled. 0 for none, 1 for isolated
 * days. Same algorithm as bestStepLoggingStreak -- a best-ever figure that only
 * grows, so a "longest streak" reading can never go backwards on a slip.
 */
export function longestCleanStreak(dates: string[]): number {
  const unique = Array.from(new Set(dates)).sort();
  if (unique.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    if (dayUtc(unique[i]) - dayUtc(unique[i - 1]) === DAY_MS) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }
  return best;
}

/**
 * Consecutive clean days ending today (or yesterday). Non-punitive: a not-yet-
 * marked today does NOT break the streak -- it counts back from yesterday -- so a
 * member isn't shown a broken streak just because they haven't checked in yet.
 * A genuine slip (or an unmarked gap in the past) does end the run. Mirrors the
 * home-screen computeStreak.
 *
 * The grace is only for an UNMARKED today. If the member explicitly logged a slip
 * TODAY (todaySlipped), the run has genuinely ended today, so we do not fall back
 * to yesterday -- the current streak is 0. (A slip on a past day already breaks
 * the run naturally, since that day isn't in the clean set.)
 */
export function currentCleanStreak(dates: string[], todayIso: string, todaySlipped = false): number {
  const set = new Set(dates);
  const today = dayUtc(todayIso);
  let cursor: number;
  if (set.has(todayIso)) {
    cursor = today; // today is clean -> count it and back
  } else if (todaySlipped) {
    return 0; // explicit slip today ends the run -- no grace
  } else {
    cursor = today - DAY_MS; // unmarked today -> grace, count from yesterday
  }
  let streak = 0;
  while (set.has(isoOf(cursor))) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

function isoOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export type HabitProgress = {
  cleanDays: number;
  slipDays: number;
  targetDays: number;
  /** Clean days still needed to reach the goal (0 once complete). */
  remaining: number;
  /** 0..100, capped. */
  percent: number;
  isComplete: boolean;
  longestStreak: number;
  currentStreak: number;
};

/** The summary a Clean Streak surface needs, from a challenge's check-ins. */
export function computeHabitProgress(
  targetDays: number,
  checkIns: DayMark[],
  todayIso: string
): HabitProgress {
  const clean = cleanDates(checkIns);
  const cleanDays = clean.length;
  const slipDays = checkIns.length - cleanDays;
  const target = Math.max(1, targetDays);
  // A slip logged for today ends the current run today (see currentCleanStreak).
  const todaySlipped = checkIns.some((c) => c.check_in_date === todayIso && c.outcome === "slip");
  return {
    cleanDays,
    slipDays,
    targetDays,
    remaining: Math.max(0, target - cleanDays),
    // floor, not round: the bar must not read a full 100% until the goal is
    // actually reached (round would show 100% at target-1 for large targets).
    percent: Math.min(100, Math.floor((cleanDays / target) * 100)),
    isComplete: cleanDays >= target,
    longestStreak: longestCleanStreak(clean),
    currentStreak: currentCleanStreak(clean, todayIso, todaySlipped),
  };
}
