import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getPosts } from "@/lib/community/queries";
import { evaluateBadges, countEarned, type Badge } from "./badges";
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

  let morningDates: string[] = [];
  let nightDates: string[] = [];
  let themedCount = 0;
  let postCount = 0;
  let recentWins: RecentWin[] = [];

  try {
    // Routine/check-in tables live in the `private` schema; community_posts is
    // in `public`. They MUST be queried with the matching client or the query
    // 404s against real PostgREST regardless of RLS (see lib/supabase/server.ts).
    const privateClient = await createClient("private");
    const publicClient = await createClient();
    const [{ data: mornings }, { data: nights }, { count: themed }, { count: posts }] = await Promise.all([
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
    ]);
    morningDates = (mornings ?? []).map((r) => r.entry_date as string);
    nightDates = (nights ?? []).map((r) => r.entry_date as string);
    themedCount = themed ?? 0;
    postCount = posts ?? 0;

    // Site-wide wins board -- public posts people chose to share, so surfacing
    // them here breaches no privacy (unlike anything in the private tables
    // above). Best-effort: a failure just leaves the widget empty.
    try {
      const wins = await getPosts(publicClient, { scope: "global", board: "wins", viewerUserId: userId });
      recentWins = wins.slice(0, 3).map((w) => ({
        id: w.id,
        authorDisplayName: w.authorDisplayName,
        body: w.body,
      }));
    } catch {
      recentWins = [];
    }
  } catch {
    // fall through with zero/empty defaults
  }

  const activeDates = new Set<string>([...morningDates, ...nightDates]);
  const activeDayCount = activeDates.size;
  const morningCount = morningDates.length;
  const nightCount = nightDates.length;
  const winsCount = morningCount + nightCount + themedCount;

  const badges = evaluateBadges({ activeDayCount, morningCount, nightCount, themedCount, postCount, winsCount });
  const review = resolveReviewProgress(activeDayCount);

  return {
    activeDayCount,
    streak: computeStreak(activeDates, todayISO),
    winsCount,
    rank: resolveRank(activeDayCount),
    badges,
    badgesEarned: countEarned(badges),
    ...review,
    recentWins,
  };
}
