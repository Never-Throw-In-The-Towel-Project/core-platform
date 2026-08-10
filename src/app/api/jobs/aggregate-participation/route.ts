import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCronRequest } from "@/lib/auth/cron";
import { getMondayOfWeek, todayISODate, weekdayNameOrWeekend } from "@/lib/routines/dates";
import type { ReviewType, Weekday } from "@/types/database";

const WEEKDAYS: readonly Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const REVIEW_TYPES: readonly ReviewType[] = ["30_day", "90_day"];

// Not a real calendar period -- see the comment on company_review_completions
// below. Fixed so every run's upsert lands on the same row per
// (company, review_type), turning that table into a running total rather
// than a genuine per-period breakdown.
const REVIEW_TOTALS_SENTINEL_PERIOD_START = "2000-01-01";

/**
 * The private -> public aggregation job docs/ARCHITECTURE.md flagged as
 * "not yet implemented" in Phase 1. Runs daily via Vercel Cron (see
 * vercel.json), authenticated by a shared secret since this is the one
 * route in the app that reads across every user's private data at once
 * (via the service-role client) -- see src/lib/supabase/admin.ts.
 *
 * Computes yesterday's participation (the most recent day that's fully
 * settled) for every company in one pass: two admin-client reads (all
 * employee profiles for the company_id map, then the private-schema
 * completion rows for that date) aggregated in memory, rather than a
 * cross-schema join -- PostgREST/supabase-js queries are schema-scoped to
 * one schema per request, so a join across `public.profiles` and
 * `private.morning_entries` isn't a single query here.
 */
export async function GET(request: NextRequest) {
  if (!(await verifyCronRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dateParam = request.nextUrl.searchParams.get("date");
  const targetDate = dateParam ?? yesterday();
  const targetDateObj = new Date(targetDate + "T00:00:00Z");
  // Cross-company aggregation, not any one user's local day -- deliberately
  // UTC (Phase 9). See docs/ARCHITECTURE.md "Per-user timezone".
  const targetWeekday = weekdayNameOrWeekend(targetDateObj, "UTC");
  const isWeekday = (WEEKDAYS as readonly string[]).includes(targetWeekday);

  const publicClient = createAdminClient();
  const privateClient = createAdminClient("private");

  const { data: profiles, error: profilesError } = await publicClient
    .from("profiles")
    .select("id, company_id")
    .eq("role", "employee");

  if (profilesError || !profiles) {
    return NextResponse.json({ error: "failed to load profiles" }, { status: 500 });
  }

  const companyByUser = new Map(profiles.map((p) => [p.id as string, p.company_id as string]));
  const eligibleByCompany = new Map<string, number>();
  for (const profile of profiles) {
    const companyId = profile.company_id as string;
    eligibleByCompany.set(companyId, (eligibleByCompany.get(companyId) ?? 0) + 1);
  }

  const [{ data: morningRows }, { data: nightRows }, { data: themedRows }] = await Promise.all([
    privateClient
      .from("morning_entries")
      .select("user_id")
      .eq("entry_date", targetDate)
      .not("completed_at", "is", null),
    privateClient
      .from("night_entries")
      .select("user_id")
      .eq("entry_date", targetDate)
      .not("completed_at", "is", null),
    isWeekday
      ? privateClient
          .from("themed_checkins")
          .select("user_id")
          .eq("week_start_date", getMondayOfWeek(targetDateObj, "UTC"))
          .eq("weekday", targetWeekday)
          .not("completed_at", "is", null)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
  ]);

  const morningCounts = countByCompany(morningRows ?? [], companyByUser);
  const nightCounts = countByCompany(nightRows ?? [], companyByUser);
  const themedCounts = countByCompany(themedRows ?? [], companyByUser);

  const participationRows = [];
  for (const [companyId, eligibleCount] of eligibleByCompany) {
    participationRows.push({
      company_id: companyId,
      entry_date: targetDate,
      weekday: null,
      segment: "morning",
      completed_count: morningCounts.get(companyId) ?? 0,
      eligible_count: eligibleCount,
    });
    participationRows.push({
      company_id: companyId,
      entry_date: targetDate,
      weekday: null,
      segment: "night",
      completed_count: nightCounts.get(companyId) ?? 0,
      eligible_count: eligibleCount,
    });
    if (isWeekday) {
      participationRows.push({
        company_id: companyId,
        entry_date: targetDate,
        weekday: targetWeekday,
        segment: "themed_checkin",
        completed_count: themedCounts.get(companyId) ?? 0,
        eligible_count: eligibleCount,
      });
    }
  }

  if (participationRows.length > 0) {
    await publicClient
      .from("company_daily_participation")
      .upsert(participationRows, { onConflict: "company_id,entry_date,segment" });
  }

  // company_review_completions: the brief's actual requirement is just "30
  // day and 90 day review completion count" per company -- a running total,
  // not a time series. Each user's own period_start is personal
  // (day-journey-based, see docs/ARCHITECTURE.md), so there's no shared
  // calendar period to bucket by across a company's cohort the way daily
  // participation has a shared entry_date. Every run recomputes the full
  // all-time count and upserts onto the same sentinel period_start row per
  // (company, review_type).
  const { data: reviewRows } = await privateClient
    .from("periodic_reviews")
    .select("user_id, review_type")
    .not("completed_at", "is", null);

  const reviewCountsByType = new Map<ReviewType, Map<string, number>>();
  for (const row of reviewRows ?? []) {
    const companyId = companyByUser.get(row.user_id as string);
    if (!companyId) continue;
    const reviewType = row.review_type as ReviewType;
    if (!reviewCountsByType.has(reviewType)) reviewCountsByType.set(reviewType, new Map());
    const companyCounts = reviewCountsByType.get(reviewType)!;
    companyCounts.set(companyId, (companyCounts.get(companyId) ?? 0) + 1);
  }

  const reviewCompletionRows = [];
  for (const reviewType of REVIEW_TYPES) {
    const companyCounts = reviewCountsByType.get(reviewType) ?? new Map<string, number>();
    for (const [companyId, eligibleCount] of eligibleByCompany) {
      reviewCompletionRows.push({
        company_id: companyId,
        review_type: reviewType,
        period_start: REVIEW_TOTALS_SENTINEL_PERIOD_START,
        completed_count: companyCounts.get(companyId) ?? 0,
        eligible_count: eligibleCount,
      });
    }
  }

  if (reviewCompletionRows.length > 0) {
    await publicClient
      .from("company_review_completions")
      .upsert(reviewCompletionRows, { onConflict: "company_id,review_type,period_start" });
  }

  return NextResponse.json({
    ok: true,
    targetDate,
    companiesProcessed: eligibleByCompany.size,
  });
}

function countByCompany(
  rows: { user_id: string }[],
  companyByUser: Map<string, string>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const companyId = companyByUser.get(row.user_id);
    if (!companyId) continue;
    counts.set(companyId, (counts.get(companyId) ?? 0) + 1);
  }
  return counts;
}

function yesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return todayISODate(d, "UTC");
}
