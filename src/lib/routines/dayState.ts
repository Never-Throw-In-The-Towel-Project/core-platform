import "server-only";
import { createClient } from "@/lib/supabase/server";
import { catchUpEligibleWeekdays, getMondayOfWeek, localHour, weekdayNameOrWeekend, type TimeZone } from "./dates";
import type { Weekday } from "@/types/database";

// Home-screen phase resolution, per the brief: Morning Routine "at the top
// of the home screen before midday", the themed check-in "becomes the main
// screen" after midday, Night Routine "at the top of the home screen after
// 7pm". Weekday check-ins only exist Mon-Fri -- see docs/ARCHITECTURE.md
// "week-journeys" for why weekends deliberately don't get one.
export type HomePhase =
  | { kind: "morning" }
  | { kind: "themed"; weekday: Weekday }
  | { kind: "weekend_midday"; isSunday: boolean }
  | { kind: "night" };

export function resolveHomePhase(now: Date, timeZone: TimeZone): HomePhase {
  const hour = localHour(now, timeZone);

  if (hour < 12) return { kind: "morning" };
  if (hour >= 19) return { kind: "night" };

  const weekday = weekdayNameOrWeekend(now, timeZone);
  if (weekday === "saturday" || weekday === "sunday") {
    return { kind: "weekend_midday", isSunday: weekday === "sunday" };
  }
  return { kind: "themed", weekday };
}

/**
 * Active-engagement day count: distinct calendar dates on which the user
 * completed at least a Morning or Night entry, not days since signup. A
 * user who goes quiet for a week doesn't lose their place, but doesn't
 * advance either. Drives the automatic 30/90-Day Review trigger (see
 * getPendingPeriodicReview) -- keep this the single source of that number
 * so the two never drift apart. Also now shown to the user directly as
 * "Day N" on the Rail (see docs/ARCHITECTURE.md "No day numbers" -- revised
 * to show it after all, alongside the this-week catch-up change below).
 */
export async function getActiveDayCount(userId: string): Promise<number> {
  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed (node_modules/@supabase/ssr/dist/main/
  // createServerClient.js) -- same gap already closed on the auth-critical
  // path (lib/auth/dal.ts, proxy.ts, lib/actions/auth.ts). This function is
  // in the call chain of /home, the universal post-login/post-onboarding
  // landing page, so a throw here took down that page for everyone.
  // Degrading to 0 (a brand-new user's actual count) is a safe fallback --
  // it never advances a real streak, just under-counts on a transient
  // failure.
  try {
    const supabase = await createClient("private");

    const [{ data: mornings }, { data: nights }] = await Promise.all([
      supabase
        .from("morning_entries")
        .select("entry_date")
        .eq("user_id", userId)
        .not("completed_at", "is", null),
      supabase
        .from("night_entries")
        .select("entry_date")
        .eq("user_id", userId)
        .not("completed_at", "is", null),
    ]);

    const days = new Set<string>();
    for (const row of mornings ?? []) days.add(row.entry_date as string);
    for (const row of nights ?? []) days.add(row.entry_date as string);

    return days.size;
  } catch {
    return 0;
  }
}

/**
 * Which of this real week's Mon-Fri themed check-ins already have a
 * `completed_at` -- the single query behind both the Rail's weekly tracker
 * (every weekday, done or not) and getOutstandingWeekdaysThisWeek below
 * (done vs. still-open), so a page needing both doesn't query twice.
 */
export async function getThemedCheckinCompletionThisWeek(
  userId: string,
  now: Date,
  timeZone: TimeZone
): Promise<Set<Weekday>> {
  // See getActiveDayCount's comment above -- same guard, same reasoning.
  // Degrading to an empty set just shows nothing as done yet this week,
  // which is always a safe (if pessimistic) fallback.
  try {
    const supabase = await createClient("private");

    const { data } = await supabase
      .from("themed_checkins")
      .select("weekday, completed_at")
      .eq("user_id", userId)
      .eq("week_start_date", getMondayOfWeek(now, timeZone));

    return new Set((data ?? []).filter((row) => row.completed_at).map((row) => row.weekday as Weekday));
  } catch {
    return new Set();
  }
}

/**
 * This real week's Mon-Fri themed check-ins that have opened
 * (`catchUpEligibleWeekdays`) but have no `completed_at` yet -- what the
 * Rail offers as optional, non-blocking catch-up (see docs/ARCHITECTURE.md
 * "Daily core loop" -- revised from the original no-backfill design).
 * Ordered Monday-first. Today's own weekday is included if not yet done,
 * same as every earlier day this week -- callers that already show today's
 * phase as the hero card should filter it out to avoid listing it twice.
 */
export async function getOutstandingWeekdaysThisWeek(
  userId: string,
  now: Date,
  timeZone: TimeZone
): Promise<Weekday[]> {
  const eligible = catchUpEligibleWeekdays(now, timeZone);
  const completed = await getThemedCheckinCompletionThisWeek(userId, now, timeZone);
  return eligible.filter((weekday) => !completed.has(weekday));
}
