import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayISODate } from "./dates";
import type { HabitSummary, ReviewType } from "@/types/database";

const THRESHOLDS: Record<ReviewType, number> = { "30_day": 30, "90_day": 90 };

/**
 * The calendar date of the user's first ever completed Morning or Night
 * entry -- used as `periodic_reviews.period_start`. Day-journeys (see
 * docs/ARCHITECTURE.md) are tracked by active-engagement days, not calendar
 * days, so "30/90 days" is a count of active days that can span any number
 * of calendar weeks -- period_start anchors the review to when the journey
 * actually began, period_end (set at completion) is whenever that count was
 * reached.
 */
export async function getFirstActiveDate(userId: string): Promise<string | null> {
  const supabase = await createClient("private");

  const [{ data: morning }, { data: night }] = await Promise.all([
    supabase
      .from("morning_entries")
      .select("entry_date")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("entry_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("night_entries")
      .select("entry_date")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("entry_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const dates = [morning?.entry_date, night?.entry_date].filter(Boolean) as string[];
  if (dates.length === 0) return null;
  return dates.sort()[0];
}

/**
 * Which automatic review (if any) is due right now. The brief calls the
 * 30-day mark "the critical retention point" and the 90-day mark the one
 * that "triggers the renewal conversation" -- both take over the home
 * screen as a full-screen moment (see src/app/(app)/home/page.tsx) rather
 * than being just another link, so this check runs before the normal
 * morning/themed/night dispatch.
 */
export async function getPendingPeriodicReview(
  userId: string,
  activeDayCount: number
): Promise<ReviewType | null> {
  const supabase = await createClient("private");

  const { data: completed } = await supabase
    .from("periodic_reviews")
    .select("review_type")
    .eq("user_id", userId)
    .not("completed_at", "is", null);

  const done = new Set((completed ?? []).map((r) => r.review_type as ReviewType));

  if (activeDayCount >= THRESHOLDS["90_day"] && !done.has("90_day")) return "90_day";
  if (activeDayCount >= THRESHOLDS["30_day"] && !done.has("30_day")) return "30_day";
  return null;
}

export async function getHabitSummary(
  userId: string,
  periodStart: string,
  periodEnd: string = todayISODate()
): Promise<HabitSummary> {
  const supabase = await createClient("private");

  const [{ count: morningCompleted }, { count: nightCompleted }, { count: themedCompleted }] =
    await Promise.all([
      supabase
        .from("morning_entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .gte("entry_date", periodStart)
        .lte("entry_date", periodEnd),
      supabase
        .from("night_entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .gte("entry_date", periodStart)
        .lte("entry_date", periodEnd),
      supabase
        .from("themed_checkins")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .gte("week_start_date", periodStart)
        .lte("week_start_date", periodEnd),
    ]);

  const eligibleDays = daysBetween(periodStart, periodEnd);
  const eligibleWeekdays = Math.floor((eligibleDays / 7) * 5);

  return {
    morning_completed: morningCompleted ?? 0,
    morning_eligible: eligibleDays,
    night_completed: nightCompleted ?? 0,
    night_eligible: eligibleDays,
    themed_completed: themedCompleted ?? 0,
    themed_eligible: eligibleWeekdays,
  };
}

function daysBetween(start: string, end: string): number {
  const ms = new Date(end + "T00:00:00Z").getTime() - new Date(start + "T00:00:00Z").getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}
