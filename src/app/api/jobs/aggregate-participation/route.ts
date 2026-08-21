import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCronRequest } from "@/lib/auth/cron";
import { getMondayOfWeek, recentUtcDates, weekdayNameOrWeekend } from "@/lib/routines/dates";
import type { ReviewType, Weekday } from "@/types/database";

const WEEKDAYS: readonly Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const REVIEW_TYPES: readonly ReviewType[] = ["30_day", "60_day", "90_day"];

// How many trailing UTC days each run re-aggregates. `entry_date` is written
// in each user's OWN timezone, so a single "yesterday-UTC" pass under-counts
// anyone whose local day hasn't ended yet at 02:00 UTC (all of the Americas).
// A date is fully settled in every timezone on Earth within ~26h of UTC
// midnight, so re-running the idempotent upsert over the last few UTC days
// lets each day's count self-correct once it has closed everywhere. Three
// gives comfortable margin (a day is re-aggregated on three consecutive runs)
// without any fragile "westmost zone in use" assumption. See
// docs/ARCHITECTURE.md "Per-user timezone".
const AGGREGATION_WINDOW_DAYS = 3;

// PostgREST caps every response at max_rows (1000, supabase/config.toml) with a
// silently-truncated 200. These reads are PLATFORM-WIDE (every employee, every
// completion for a date), so they blow past 1000 for even a modest user base --
// every one must page with `.range()` and hard-fail on error rather than
// aggregate a partial set into a wrong dashboard number. `.order()` on a unique,
// stable column is REQUIRED: range paging without a total order can skip or
// duplicate rows across pages. `makeQuery` must build a fresh query each call.
const PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: { message?: string } | null };

async function fetchAll<T>(makeQuery: (from: number, to: number) => PromiseLike<PageResult<T>>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await makeQuery(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message ?? "query failed");
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

type ParticipationRow = {
  company_id: string;
  entry_date: string;
  weekday: Weekday | null;
  segment: "morning" | "night" | "themed_checkin";
  completed_count: number;
  eligible_count: number;
};

type AdminClient = ReturnType<typeof createAdminClient>;

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
 * Computes participation for every company in one pass: two admin-client
 * reads (all employee profiles for the company_id map, then the private-schema
 * completion rows for each target date) aggregated in memory, rather than a
 * cross-schema join -- PostgREST/supabase-js queries are schema-scoped to
 * one schema per request, so a join across `public.profiles` and
 * `private.morning_entries` isn't a single query here. All reads PAGE (see
 * fetchAll) so the platform-wide scans stay correct past 1000 rows.
 *
 * It re-aggregates a trailing window of recent UTC days
 * (AGGREGATION_WINDOW_DAYS), not just yesterday-UTC, because `entry_date` is
 * stored in each user's own timezone (Phase 9): a day western users are still
 * living through when the 02:00-UTC job first runs would otherwise have its
 * evening/night completions permanently under-counted. The upsert is
 * idempotent per (company, entry_date, segment) and every count is recomputed
 * from source, so re-running a day once it has fully settled everywhere simply
 * overwrites the earlier partial count with the correct one. `?date=` still
 * forces a single explicit date (manual backfill / tests).
 */
export async function GET(request: NextRequest) {
  if (!(await verifyCronRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dateParam = request.nextUrl.searchParams.get("date");
  const targetDates = dateParam ? [dateParam] : recentUtcDates(new Date(), AGGREGATION_WINDOW_DAYS);

  const publicClient = createAdminClient();
  const privateClient = createAdminClient("private");

  let profiles: { id: string; company_id: string }[];
  try {
    profiles = await fetchAll<{ id: string; company_id: string }>((from, to) =>
      publicClient.from("profiles").select("id, company_id").eq("role", "employee").order("id").range(from, to)
    );
  } catch {
    return NextResponse.json({ error: "failed to load profiles" }, { status: 500 });
  }

  const companyByUser = new Map(profiles.map((p) => [p.id, p.company_id]));
  const eligibleByCompany = new Map<string, number>();
  for (const profile of profiles) {
    eligibleByCompany.set(profile.company_id, (eligibleByCompany.get(profile.company_id) ?? 0) + 1);
  }

  // Aggregate each date independently; a date whose read fails is skipped (its
  // rows aren't written) rather than failing the whole run or writing a partial
  // count -- the idempotent upsert re-does it next run.
  const perDate = await Promise.all(
    targetDates.map((date) =>
      aggregateParticipationForDate(privateClient, date, companyByUser, eligibleByCompany).catch(() => null)
    )
  );
  const participationRows = perDate.filter((r): r is ParticipationRow[] => r !== null).flat();
  const datesSkipped = perDate.filter((r) => r === null).length;

  if (participationRows.length > 0) {
    const { error } = await publicClient
      .from("company_daily_participation")
      .upsert(participationRows, { onConflict: "company_id,entry_date,segment" });
    if (error) {
      return NextResponse.json({ error: "failed to persist participation", datesSkipped }, { status: 500 });
    }
  }

  // company_review_completions: the brief's actual requirement is just "30
  // day and 90 day review completion count" per company -- a running total,
  // not a time series. Each user's own period_start is personal
  // (day-journey-based, see docs/ARCHITECTURE.md), so there's no shared
  // calendar period to bucket by across a company's cohort the way daily
  // participation has a shared entry_date. Every run recomputes the full
  // all-time count and upserts onto the same sentinel period_start row per
  // (company, review_type). Read paged; if it fails, skip the review upsert
  // this run (keep last run's counts) rather than writing zeros.
  let reviewRows: { user_id: string; review_type: string }[] | null = null;
  try {
    reviewRows = await fetchAll<{ user_id: string; review_type: string }>((from, to) =>
      privateClient
        .from("periodic_reviews")
        .select("user_id, review_type")
        .not("completed_at", "is", null)
        .order("id")
        .range(from, to)
    );
  } catch {
    reviewRows = null;
  }

  let reviewsCounted = false;
  if (reviewRows) {
    const reviewCountsByType = new Map<ReviewType, Map<string, number>>();
    for (const row of reviewRows) {
      const companyId = companyByUser.get(row.user_id);
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
      const { error } = await publicClient
        .from("company_review_completions")
        .upsert(reviewCompletionRows, { onConflict: "company_id,review_type,period_start" });
      reviewsCounted = !error;
    } else {
      reviewsCounted = true;
    }
  }

  return NextResponse.json({
    ok: true,
    targetDates,
    companiesProcessed: eligibleByCompany.size,
    datesSkipped,
    reviewsCounted,
  });
}

/**
 * All participation rows for one calendar date, across every company. The
 * date is treated exactly as before (its weekday/Monday-of-week resolved in
 * UTC -- one company-wide notion of "day"/"week" for bucketing many users'
 * rows, per docs/ARCHITECTURE.md "Per-user timezone"); the caller just runs
 * this over a trailing window of dates instead of a single one, so late
 * completions from western timezones are picked up on a later run. Each read
 * pages (fetchAll) and throws on error, so a truncated/failed date is skipped
 * by the caller rather than silently under-counted.
 */
async function aggregateParticipationForDate(
  privateClient: AdminClient,
  targetDate: string,
  companyByUser: Map<string, string>,
  eligibleByCompany: Map<string, number>
): Promise<ParticipationRow[]> {
  const targetDateObj = new Date(targetDate + "T00:00:00Z");
  const targetWeekday = weekdayNameOrWeekend(targetDateObj, "UTC");
  const isWeekday = (WEEKDAYS as readonly string[]).includes(targetWeekday);

  const [morningRows, nightRows, themedRows] = await Promise.all([
    fetchAll<{ user_id: string }>((from, to) =>
      privateClient
        .from("morning_entries")
        .select("user_id")
        .eq("entry_date", targetDate)
        .not("completed_at", "is", null)
        .order("id")
        .range(from, to)
    ),
    fetchAll<{ user_id: string }>((from, to) =>
      privateClient
        .from("night_entries")
        .select("user_id")
        .eq("entry_date", targetDate)
        .not("completed_at", "is", null)
        .order("id")
        .range(from, to)
    ),
    isWeekday
      ? fetchAll<{ user_id: string }>((from, to) =>
          privateClient
            .from("themed_checkins")
            .select("user_id")
            .eq("week_start_date", getMondayOfWeek(targetDateObj, "UTC"))
            .eq("weekday", targetWeekday)
            .not("completed_at", "is", null)
            .order("id")
            .range(from, to)
        )
      : Promise.resolve([] as { user_id: string }[]),
  ]);

  const morningCounts = countByCompany(morningRows, companyByUser);
  const nightCounts = countByCompany(nightRows, companyByUser);
  const themedCounts = countByCompany(themedRows, companyByUser);

  const rows: ParticipationRow[] = [];
  for (const [companyId, eligibleCount] of eligibleByCompany) {
    rows.push({
      company_id: companyId,
      entry_date: targetDate,
      weekday: null,
      segment: "morning",
      completed_count: morningCounts.get(companyId) ?? 0,
      eligible_count: eligibleCount,
    });
    rows.push({
      company_id: companyId,
      entry_date: targetDate,
      weekday: null,
      segment: "night",
      completed_count: nightCounts.get(companyId) ?? 0,
      eligible_count: eligibleCount,
    });
    if (isWeekday) {
      rows.push({
        company_id: companyId,
        entry_date: targetDate,
        weekday: targetWeekday as Weekday,
        segment: "themed_checkin",
        completed_count: themedCounts.get(companyId) ?? 0,
        eligible_count: eligibleCount,
      });
    }
  }
  return rows;
}

function countByCompany(rows: { user_id: string }[], companyByUser: Map<string, string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const companyId = companyByUser.get(row.user_id);
    if (!companyId) continue;
    counts.set(companyId, (counts.get(companyId) ?? 0) + 1);
  }
  return counts;
}
