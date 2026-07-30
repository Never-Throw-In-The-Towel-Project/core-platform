import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayISODate, weekdayNameOrWeekend } from "./dates";
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

export function resolveHomePhase(now: Date = new Date()): HomePhase {
  const hour = now.getUTCHours();

  if (hour < 12) return { kind: "morning" };
  if (hour >= 19) return { kind: "night" };

  const weekday = weekdayNameOrWeekend(now);
  if (weekday === "saturday" || weekday === "sunday") {
    return { kind: "weekend_midday", isSunday: weekday === "sunday" };
  }
  return { kind: "themed", weekday };
}

/**
 * "Day N" is a day-journey, resolved by CTO decision in favour of active
 * engagement over calendar time: it counts distinct calendar dates on which
 * the user completed at least a Morning or Night entry, not days since
 * signup. A user who goes quiet for a week doesn't lose their place, but
 * doesn't advance either. This is also the counter that will drive the
 * automatic 30/90-Day Review trigger in Phase 3 -- keep this the single
 * source of that number so the two never drift apart.
 */
export async function getDayCounter(userId: string): Promise<{ dayNumber: number; completedDays: number }> {
  const supabase = await createClient();

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

  const completedDays = days.size;
  const today = todayISODate();
  const dayNumber = days.has(today) ? completedDays : completedDays + 1;

  return { dayNumber, completedDays };
}
