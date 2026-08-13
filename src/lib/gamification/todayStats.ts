import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getPosts } from "@/lib/community/queries";
import { maxSingleDaySteps, bestStepLoggingStreak } from "@/lib/steps/milestones";
import { evaluateBadges, countEarned, type Badge, type BadgeStatsInput } from "./badges";
import { resolveRank, type Rank } from "./rank";
import { todayISODate, type TimeZone } from "@/lib/routines/dates";

/** Thresholds that drive both the ring and the "days to review" line. */
const FIRST_REVIEW = 30;
const SECOND_REVIEW = 90;

export interface RecentWin {
  id: string;
  authorDisplayName: string;
  body: string;
}

export interface TodayStats {
  activeDayCount: number;
  /** Consecutive active days ending today (or the last active day). */
  streak: number;
  /** Completed sessions all-time = "wins" ("win the round"). */
  winsCount: number;
  rank: Rank;
  badges: Badge[];
  badgesEarned: number;
  /** 0-100 progress toward the next review milestone. */
  ringPct: number;
  daysToReview: number;
  reviewLabel: string;
  reviewComplete: boolean;
  /** A few recent public wins from the site-wide board, for the wins widget. */
  recentWins: RecentWin[];
}

/** Shift a floating (zone-less) ISO calendar date by -1 day. */
function previousISODate(iso: string): string {
  const t = new Date(`${iso}T00:00:00Z`).getTime() - 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Consecutive-day streak. Anchored to today if today is already active, else
 * to yesterday -- so the streak a user built doesn't read as broken simply
 * because they haven't done today's routine *yet* (it only truly breaks once
 * a whole day is skipped). Non-punitive by construction: it counts up, never
 * penalises, and a gone-quiet user just sees 0, never a negative or a shaming
 * message.
 */
export function computeStreak(activeDates: Set<string>, todayISO: string): number {
  let cursor: string;
  if (activeDates.has(todayISO)) {
    cursor = todayISO;
  } else {
    const yesterday = previousISODate(todayISO);
    if (!activeDates.has(yesterday)) return 0;
    cursor = yesterday;
  }

  let streak = 0;
  while (activeDates.has(cursor)) {
    streak += 1;
    cursor = previousISODate(cursor);
  }
  return streak;
}

function resolveReviewProgress(activeDayCount: number): {
  ringPct: number;
  daysToReview: number;
  reviewLabel: string;
  reviewComplete: boolean;
} {
  if (activeDayCount >= SECOND_REVIEW) {
    return { ringPct: 100, daysToReview: 0, reviewLabel: "90 Day Review", reviewComplete: true };
  }
  const [prev, next, label] =
    activeDayCount < FIRST_REVIEW
      ? [0, FIRST_REVIEW, "30 Day Review"]
      : [FIRST_REVIEW, SECOND_REVIEW, "90 Day Review"];
  const ringPct = Math.max(0, Math.min(100, Math.round(((activeDayCount - prev) / (next - prev)) * 100)));
  return { ringPct, daysToReview: Math.max(0, next - activeDayCount), reviewLabel: label, reviewComplete: false };
}

/** The raw engagement a member has built, derived from records the platform
 *  already keeps. All monotonic, all non-private (completed routines/check-ins
 *  and public posts) -- never a journal answer, sleep score, or day rating. */
export interface EngagementCounts {
  activeDates: Set<string>;
  activeDayCount: number;
  morningCount: number;
  nightCount: number;
  themedCount: number;
  postCount: number;
  /** Completed sessions all-time = "wins". */
  winsCount: number;
  /** Highest steps on any single day, best-ever (0 if never logged). */
  maxSingleDaySteps: number;
  /** Longest run of consecutive logged step days, best-ever. */
  bestStepStreak: number;
}

/**
 * Gather a member's engagement counts. Shared by the Today stats and the badge
 * persistence action so both derive badges from exactly the same numbers.
 * Defensive: any DB failure degrades to a brand-new-user zero state.
 */
export async function gatherEngagement(userId: string): Promise<EngagementCounts> {
  let morningDates: string[] = [];
  let nightDates: string[] = [];
  let themedCount = 0;
  let postCount = 0;
  let stepEntries: { entry_date: string; steps: number }[] = [];

  try {
    // Routine/check-in tables live in the `private` schema; community_posts is
    // in `public`. They MUST be queried with the matching client or the query
    // 404s against real PostgREST regardless of RLS (see lib/supabase/server.ts).
    const privateClient = await createClient("private");
    const publicClient = await createClient();
    const [{ data: mornings }, { data: nights }, { count: themed }, { count: posts }, { data: steps }] =
      await Promise.all([
        privateClient.from("morning_entries").select("entry_date").eq("user_id", userId).not("completed_at", "is", null),
        privateClient.from("night_entries").select("entry_date").eq("user_id", userId).not("completed_at", "is", null),
        privateClient
          .from("themed_checkins")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .not("completed_at", "is", null),
        publicClient
          .from("community_posts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_removed", false),
        // One row per logged day (private, own-rows-only) -- used only to derive
        // the member's own monotonic step milestones, never aggregated or shared.
        privateClient.from("step_entries").select("entry_date, steps").eq("user_id", userId),
      ]);
    morningDates = (mornings ?? []).map((r) => r.entry_date as string);
    nightDates = (nights ?? []).map((r) => r.entry_date as string);
    themedCount = themed ?? 0;
    postCount = posts ?? 0;
    stepEntries = (steps ?? []).map((r) => ({ entry_date: r.entry_date as string, steps: r.steps as number }));
  } catch {
    // fall through with zero/empty defaults
  }

  const activeDates = new Set<string>([...morningDates, ...nightDates]);
  const morningCount = morningDates.length;
  const nightCount = nightDates.length;
  return {
    activeDates,
    activeDayCount: activeDates.size,
    morningCount,
    nightCount,
    themedCount,
    postCount,
    winsCount: morningCount + nightCount + themedCount,
    maxSingleDaySteps: maxSingleDaySteps(stepEntries),
    bestStepStreak: bestStepLoggingStreak(stepEntries.map((e) => e.entry_date)),
  };
}

/** The subset of engagement the badge catalogue evaluates against. */
export function badgeStatsFrom(eng: EngagementCounts): BadgeStatsInput {
  return {
    activeDayCount: eng.activeDayCount,
    morningCount: eng.morningCount,
    nightCount: eng.nightCount,
    themedCount: eng.themedCount,
    postCount: eng.postCount,
    winsCount: eng.winsCount,
    maxSingleDaySteps: eng.maxSingleDaySteps,
    bestStepStreak: eng.bestStepStreak,
  };
}

/**
 * Everything the Today progress band + right rail need, wired to real data.
 * The gamification numbers are all *derived* from records the platform
 * already keeps (completed routines/check-ins, community posts) -- nothing
 * here reads a private journal answer, a sleep score or a day rating, and
 * none of it is ever reported to a company. Defensive throughout: any DB
 * failure degrades to a brand-new-user zero state rather than crashing the
 * universal /home landing page (same pattern as lib/routines/*).
 */
export async function getTodayStats(userId: string, now: Date, timeZone: TimeZone): Promise<TodayStats> {
  const todayISO = todayISODate(now, timeZone);
  const eng = await gatherEngagement(userId);

  // Site-wide wins board -- public posts people chose to share, so surfacing
  // them here breaches no privacy (unlike anything in the private tables above).
  // Best-effort: a failure just leaves the widget empty.
  let recentWins: RecentWin[] = [];
  try {
    const publicClient = await createClient();
    const wins = await getPosts(publicClient, { scope: "global", board: "wins", viewerUserId: userId });
    recentWins = wins.slice(0, 3).map((w) => ({ id: w.id, authorDisplayName: w.authorDisplayName, body: w.body }));
  } catch {
    recentWins = [];
  }

  const badges = evaluateBadges(badgeStatsFrom(eng));
  const review = resolveReviewProgress(eng.activeDayCount);

  return {
    activeDayCount: eng.activeDayCount,
    streak: computeStreak(eng.activeDates, todayISO),
    winsCount: eng.winsCount,
    rank: resolveRank(eng.activeDayCount),
    badges,
    badgesEarned: countEarned(badges),
    ...review,
    recentWins,
  };
}
