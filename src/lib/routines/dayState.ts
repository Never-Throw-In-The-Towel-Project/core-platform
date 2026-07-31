import "server-only";
import { createClient } from "@/lib/supabase/server";
import { localHour, weekdayNameOrWeekend, type TimeZone } from "./dates";
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
 * advance either. Per Anthony's guidance, this number is never shown to the
 * user as a "Day N" counter -- corporate users especially drift in and out
 * with shift patterns/leave, and a visible day count turns that into a
 * feeling of falling behind. It exists purely to drive the automatic
 * 30/90-Day Review trigger (see getPendingPeriodicReview) -- keep this the
 * single source of that number so the two never drift apart.
 */
export async function getActiveDayCount(userId: string): Promise<number> {
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
}
