import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getMondayOfWeek } from "./dates";
import type { HabitSummary, ReviewType } from "@/types/database";

const THRESHOLDS: Record<ReviewType, number> = { "30_day": 30, "60_day": 60, "90_day": 90 };

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
  // Wrapped in try/catch, same reasoning as getPendingPeriodicReview below:
  // createClient() can throw synchronously, and null here just means the
  // caller falls back to today's date as period_start (see periodicReview.ts's
  // action) rather than crashing the review submission on a transient failure.
  try {
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
  } catch {
    return null;
  }
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
  // See dayState.ts's getActiveDayCount comment: createClient() can throw
  // synchronously, and this runs in /home's render path, the universal
  // post-login/post-onboarding landing page. Degrading to "no review due"
  // is the safe direction -- it defers the review prompt to the next
  // successful load rather than blocking the whole home screen on a
  // transient failure.
  try {
    const supabase = await createClient("private");

    const { data: completed } = await supabase
      .from("periodic_reviews")
      .select("review_type")
      .eq("user_id", userId)
      .not("completed_at", "is", null);

    const done = new Set((completed ?? []).map((r) => r.review_type as ReviewType));

    // Earliest incomplete milestone first. A user who reaches 90 active days
    // without ever completing the 30-day review (reachable: active-day count
    // advances from /morning-routine and /night-routine directly, which
    // don't gate on a pending review -- only /home does) must still be shown
    // the 30-day review before the 90-day one, in order, not dropped into
    // the 90-day and then bounced back to the 30-day on the next load.
    if (activeDayCount >= THRESHOLDS["30_day"] && !done.has("30_day")) return "30_day";
    if (activeDayCount >= THRESHOLDS["60_day"] && !done.has("60_day")) return "60_day";
    if (activeDayCount >= THRESHOLDS["90_day"] && !done.has("90_day")) return "90_day";
    return null;
  } catch {
    return null;
  }
}

export async function getHabitSummary(
  userId: string,
  periodStart: string,
  periodEnd: string
): Promise<HabitSummary> {
  const eligibleDays = daysBetween(periodStart, periodEnd);
  const eligibleWeekdays = Math.floor((eligibleDays / 7) * 5);

  // Wrapped in try/catch, same reasoning as getFirstActiveDate above:
  // createClient() can throw synchronously. Degrading to zero counts (with
  // the eligible totals still correct, since those don't need the DB) is
  // the same safe direction the rest of this file already takes -- a
  // pessimistic summary, not a crashed review submission.
  try {
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
        // week_start_date is always a Monday, but periodStart (the user's
        // actual first active day) can be any weekday -- widening to that
        // week's Monday avoids undercounting a themed check-in completed
        // earlier in the same week periodStart falls in. periodStart is
        // already a resolved plain calendar-date string (no zone attached),
        // so interpreting it as UTC midnight here is just how a floating
        // date is read back, not a timezone choice.
        supabase
          .from("themed_checkins")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .not("completed_at", "is", null)
          .gte("week_start_date", getMondayOfWeek(new Date(periodStart + "T00:00:00Z"), "UTC"))
          .lte("week_start_date", periodEnd),
      ]);

    return {
      morning_completed: morningCompleted ?? 0,
      morning_eligible: eligibleDays,
      night_completed: nightCompleted ?? 0,
      night_eligible: eligibleDays,
      themed_completed: themedCompleted ?? 0,
      themed_eligible: eligibleWeekdays,
    };
  } catch {
    return {
      morning_completed: 0,
      morning_eligible: eligibleDays,
      night_completed: 0,
      night_eligible: eligibleDays,
      themed_completed: 0,
      themed_eligible: eligibleWeekdays,
    };
  }
}

function daysBetween(start: string, end: string): number {
  const ms = new Date(end + "T00:00:00Z").getTime() - new Date(start + "T00:00:00Z").getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}
