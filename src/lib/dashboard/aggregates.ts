import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMondayOfWeek } from "@/lib/routines/dates";
import type { ReviewType, Weekday } from "@/types/database";

// Every function here takes a Supabase client rather than creating its own,
// since it needs to work in two different auth contexts: the RLS-scoped
// session client for the on-demand dashboard/export (an hr_admin reading
// their own company's aggregate rows, per the read policies in the Phase 1
// migration), and the service-role admin client for the day-90 auto-report
// cron job (which has no user session to scope to). Both read only the
// public aggregate tables -- never anything in `private`.
//
// createClient()/createAdminClient() are typed with a schema union
// ("public" | "private") since they take a runtime schema parameter -- this
// alias is intentionally loose rather than fighting those generics for a
// schema distinction that doesn't matter to functions that only ever touch
// public-schema tables.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any>;

export interface WeeklyParticipation {
  weekStartDate: string;
  /**
   * 1-based position of this week among every week the company has any
   * participation data for -- Week 1 is the company's first-ever recorded
   * week, not the first week of whatever slice is being displayed. This is
   * Anthony's suggested corporate vocabulary (Phase 10): "Week 1/4/12"
   * framing for HR rather than exposing calendar dates or individual-level
   * day numbers (which are deliberately never shown at all -- see "No day
   * numbers, per Anthony's direct guidance").
   */
  weekNumber: number;
  morningPercent: number | null;
  nightPercent: number | null;
  themedPercent: number | null;
}

export interface WeekdayEngagement {
  weekday: Weekday;
  percent: number | null;
}

export interface ReviewCompletionSummary {
  reviewType: ReviewType;
  completedCount: number;
  eligibleCount: number;
}

export type ParticipationTrend = "rising" | "falling" | "steady" | "not_enough_data";

export async function getSupportCount(supabase: AnySupabaseClient, companyId: string): Promise<number> {
  const { data } = await supabase
    .from("company_support_counts")
    .select("total_count")
    .eq("company_id", companyId)
    .maybeSingle();
  return data?.total_count ?? 0;
}

export async function getReviewCompletions(
  supabase: AnySupabaseClient,
  companyId: string
): Promise<ReviewCompletionSummary[]> {
  const { data } = await supabase
    .from("company_review_completions")
    .select("review_type, completed_count, eligible_count")
    .eq("company_id", companyId);

  return (data ?? []).map((row) => ({
    reviewType: row.review_type as ReviewType,
    completedCount: row.completed_count as number,
    eligibleCount: row.eligible_count as number,
  }));
}

/** Most recent `weeks` weeks of participation, oldest first. */
export async function getWeeklyParticipation(
  supabase: AnySupabaseClient,
  companyId: string,
  weeks = 12
): Promise<WeeklyParticipation[]> {
  const { data } = await supabase
    .from("company_daily_participation")
    .select("entry_date, segment, completed_count, eligible_count")
    .eq("company_id", companyId)
    .order("entry_date", { ascending: true });

  type Bucket = { c: number; e: number };
  const byWeek = new Map<string, { morning: Bucket; night: Bucket; themed: Bucket }>();

  for (const row of data ?? []) {
    // Cross-user aggregation (Phase 9): row.entry_date is already a
    // resolved plain calendar-date string per-user, and this buckets many
    // users' rows into one company-wide week -- deliberately UTC, not any
    // one user's timezone. See docs/ARCHITECTURE.md "Per-user timezone".
    const weekStart = getMondayOfWeek(new Date(`${row.entry_date}T00:00:00Z`), "UTC");
    if (!byWeek.has(weekStart)) {
      byWeek.set(weekStart, { morning: { c: 0, e: 0 }, night: { c: 0, e: 0 }, themed: { c: 0, e: 0 } });
    }
    const bucket = byWeek.get(weekStart)!;
    const target = row.segment === "morning" ? bucket.morning : row.segment === "night" ? bucket.night : bucket.themed;
    target.c += row.completed_count as number;
    target.e += row.eligible_count as number;
  }

  // Sorted ascending over the company's ENTIRE history, not just the
  // slice being displayed -- weekNumber below is this week's 1-based
  // position in that full history, so "Week 1" always means the
  // company's actual first recorded week even when displaying, say, only
  // the most recent 12.
  const allWeeksSorted = Array.from(byWeek.keys()).sort();
  const recentWeeks = allWeeksSorted.slice(-weeks);

  return recentWeeks.map((weekStartDate) => {
    const bucket = byWeek.get(weekStartDate)!;
    return {
      weekStartDate,
      weekNumber: allWeeksSorted.indexOf(weekStartDate) + 1,
      morningPercent: percentage(bucket.morning.c, bucket.morning.e),
      nightPercent: percentage(bucket.night.c, bucket.night.e),
      themedPercent: percentage(bucket.themed.c, bucket.themed.e),
    };
  });
}

const WEEKDAY_ORDER: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];

export async function getWeekdayEngagement(
  supabase: AnySupabaseClient,
  companyId: string
): Promise<WeekdayEngagement[]> {
  const { data } = await supabase
    .from("company_daily_participation")
    .select("weekday, completed_count, eligible_count")
    .eq("company_id", companyId)
    .eq("segment", "themed_checkin");

  const byWeekday = new Map<Weekday, { c: number; e: number }>();
  for (const row of data ?? []) {
    const weekday = row.weekday as Weekday | null;
    if (!weekday) continue;
    if (!byWeekday.has(weekday)) byWeekday.set(weekday, { c: 0, e: 0 });
    const bucket = byWeekday.get(weekday)!;
    bucket.c += row.completed_count as number;
    bucket.e += row.eligible_count as number;
  }

  return WEEKDAY_ORDER.map((weekday) => {
    const bucket = byWeekday.get(weekday);
    return { weekday, percent: bucket ? percentage(bucket.c, bucket.e) : null };
  });
}

/**
 * "Overall participation trend over time (rising / falling / steady)" per
 * the brief -- compares the most recent week's average completion rate
 * (across morning/night/themed) to the week before. A flat +/-5 point band
 * counts as "steady" rather than reacting to single-week noise.
 */
export function computeOverallTrend(weeks: WeeklyParticipation[]): ParticipationTrend {
  if (weeks.length < 2) return "not_enough_data";

  const overallByWeek = weeks.map((week) =>
    average([week.morningPercent, week.nightPercent, week.themedPercent])
  );
  const last = overallByWeek[overallByWeek.length - 1];
  const previous = overallByWeek[overallByWeek.length - 2];
  if (last === null || previous === null) return "not_enough_data";

  const delta = last - previous;
  if (delta > 5) return "rising";
  if (delta < -5) return "falling";
  return "steady";
}

function percentage(completed: number, eligible: number): number | null {
  if (eligible <= 0) return null;
  return Math.round((completed / eligible) * 100);
}

function average(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return present.reduce((sum, v) => sum + v, 0) / present.length;
}
