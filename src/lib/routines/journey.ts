import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getMondayOfWeek, getNextMonday } from "./dates";

export interface JourneyStats {
  daysIn: number;
  mornings: number;
  nights: number;
  weeklyReviews: number;
}

/**
 * The stats row at the top of My Journey. `daysIn` is passed in rather than
 * recomputed -- it's the same getActiveDayCount every other caller already
 * uses, kept as the single source per docs/ARCHITECTURE.md.
 */
export async function getJourneyStats(userId: string, daysIn: number): Promise<JourneyStats> {
  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  // Zeroed counts is the same pessimistic-but-safe fallback used throughout
  // this file's callers rather than crashing My Journey.
  try {
    const supabase = await createClient("private");

    const [{ count: mornings }, { count: nights }, { count: weeklyReviews }] = await Promise.all([
      supabase
        .from("morning_entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("completed_at", "is", null),
      supabase
        .from("night_entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("completed_at", "is", null),
      supabase
        .from("weekly_reviews")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("completed_at", "is", null),
    ]);

    return { daysIn, mornings: mornings ?? 0, nights: nights ?? 0, weeklyReviews: weeklyReviews ?? 0 };
  } catch {
    return { daysIn, mornings: 0, nights: 0, weeklyReviews: 0 };
  }
}

export interface WeeklyRatings {
  avgSleep: number | null;
  avgDayRating: number | null;
}

/**
 * Average sleep score and day rating per real week, for the weeks in
 * `weekStartDates` (each a Monday). Shown only on the user's own My
 * Journey page -- sleep score and day rating are "NEVER reportable" to the
 * company (see the column comments in the Phase 2 migration), but that
 * rule is about the employer, not the user themselves; reflecting a
 * person's own private data back to them is exactly what it's for.
 *
 * One broad query per table across the whole date range, bucketed into
 * weeks in application code, rather than a query per week -- same
 * "provably correct over trusting exact SQL grouping" reasoning as
 * getHabitSummary in periodicReview.ts.
 */
export async function getWeeklyRatingAverages(
  userId: string,
  weekStartDates: string[]
): Promise<Map<string, WeeklyRatings>> {
  if (weekStartDates.length === 0) return new Map();

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  // An all-null-ratings map is the same shape RatingsChart already renders
  // fine (see journey/page.tsx), not a distinct case to crash over.
  try {
    const supabase = await createClient("private");
    const sorted = [...weekStartDates].sort();
    const rangeStart = sorted[0];
    const rangeEndExclusive = getNextMonday(new Date(`${sorted[sorted.length - 1]}T00:00:00Z`), "UTC");

    const [{ data: mornings }, { data: nights }] = await Promise.all([
      supabase
        .from("morning_entries")
        .select("entry_date, sleep_score")
        .eq("user_id", userId)
        .not("sleep_score", "is", null)
        .gte("entry_date", rangeStart)
        .lt("entry_date", rangeEndExclusive),
      supabase
        .from("night_entries")
        .select("entry_date, day_rating")
        .eq("user_id", userId)
        .not("day_rating", "is", null)
        .gte("entry_date", rangeStart)
        .lt("entry_date", rangeEndExclusive),
    ]);

    const sleepByWeek = new Map<string, number[]>();
    for (const row of mornings ?? []) {
      const week = getMondayOfWeek(new Date(`${row.entry_date}T00:00:00Z`), "UTC");
      (sleepByWeek.get(week) ?? sleepByWeek.set(week, []).get(week)!).push(row.sleep_score as number);
    }

    const ratingByWeek = new Map<string, number[]>();
    for (const row of nights ?? []) {
      const week = getMondayOfWeek(new Date(`${row.entry_date}T00:00:00Z`), "UTC");
      (ratingByWeek.get(week) ?? ratingByWeek.set(week, []).get(week)!).push(row.day_rating as number);
    }

    const average = (values: number[] | undefined) =>
      values && values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;

    return new Map(
      weekStartDates.map((week) => [
        week,
        { avgSleep: average(sleepByWeek.get(week)), avgDayRating: average(ratingByWeek.get(week)) },
      ])
    );
  } catch {
    return new Map(weekStartDates.map((week) => [week, { avgSleep: null, avgDayRating: null }]));
  }
}
