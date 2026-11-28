import Link from "next/link";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getActiveDayCount } from "@/lib/routines/dayState";
import { getJourneyStats, getWeeklyRatingAverages } from "@/lib/routines/journey";
import { getMondayOfWeek, todayISODate, weekdayNameOrWeekend } from "@/lib/routines/dates";
import { getRecentSteps } from "@/lib/steps/queries";
import { lastNDates, buildStepsWeek } from "@/lib/steps/week";
import { getActiveChallengeBrief } from "@/lib/steps/challengeQueries";
import { StepsCard } from "@/components/journey/StepsCard";
import { TrophyRoom } from "@/components/journey/TrophyRoom";
import { getEarnedBadges, type EarnedBadge } from "@/lib/gamification/earnedBadges";
import { gatherEngagement, badgeStatsFrom } from "@/lib/gamification/todayStats";
import { evaluateBadges } from "@/lib/gamification/badges";
import { CleanStreakEntryCard } from "@/components/habits/CleanStreakEntryCard";
import { getMyHabitEntrySummary, type HabitEntrySummary } from "@/lib/habits/queries";
import type { PeriodicReview, ReviewType, StepEntry, WeeklyReview } from "@/types/database";

const REVIEW_FIELDS: { key: keyof WeeklyReview; label: string }[] = [
  { key: "habits_to_double_down", label: "Which habits am I going to double down on?" },
  { key: "challenges_overcome", label: "What challenges did I overcome?" },
  { key: "lessons_learned", label: "What lessons did I learn this week?" },
  { key: "habits_served_well", label: "What habits served me well this week?" },
  { key: "challenges_helped_grow", label: "What challenges helped me grow?" },
  { key: "feels_better_from_habits", label: "Do I feel better from sticking to my positive habits?" },
  { key: "one_thing_to_improve", label: "What's one thing I can improve on that will help me move forward?" },
];

const REVIEW_THRESHOLDS: Record<ReviewType, number> = { "30_day": 30, "60_day": 60, "90_day": 90 };
const REVIEW_ROUTES: Record<ReviewType, string> = {
  "30_day": "/reviews/30-day/summary",
  "60_day": "/reviews/60-day/summary",
  "90_day": "/reviews/90-day/summary",
};
// Same routes home's own pending-review redirect uses (src/app/(app)/home/page.tsx)
// to land someone on the fill-out form, not the read-back summary.
const REVIEW_START_ROUTES: Record<ReviewType, string> = {
  "30_day": "/reviews/30-day",
  "60_day": "/reviews/60-day",
  "90_day": "/reviews/90-day",
};
const REVIEW_LABEL: Record<ReviewType, string> = {
  "30_day": "30 Day Review",
  "60_day": "60 Day Review",
  "90_day": "90 Day Review",
};
// Each milestone unlocks after the previous one is complete (30 → 60 → 90).
const REVIEW_PREREQUISITE_LABEL: Partial<Record<ReviewType, string>> = {
  "60_day": "30 Day Review",
  "90_day": "60 Day Review",
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function dowLabel(iso: string): string {
  return DOW[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

/** Picks one non-empty field from a week's review to highlight, rotating through REVIEW_FIELDS by position so the same field isn't shown every single week. */
function pickHighlight(review: WeeklyReview, startIndex: number): { label: string; value: string } | null {
  for (let i = 0; i < REVIEW_FIELDS.length; i++) {
    const field = REVIEW_FIELDS[(startIndex + i) % REVIEW_FIELDS.length];
    const value = review[field.key];
    if (typeof value === "string" && value.trim().length > 0) {
      return { label: field.label, value };
    }
  }
  return null;
}

function formatWeekRange(weekStartDate: string): string {
  const start = new Date(`${weekStartDate}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const startMonth = start.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  const endMonth = end.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  const startLabel = startMonth === endMonth ? `${start.getUTCDate()}` : `${start.getUTCDate()} ${startMonth}`;
  return `${startLabel}–${end.getUTCDate()} ${endMonth}`.toUpperCase();
}

// "My Journey" / "My History" -- per the brief's flag, Weekly Review and
// the 30/60/90-Day Reviews are a personal record the user can scroll back
// through over time, not just a one-time form. Read-only; only the user
// themselves can see this page (RLS is per-user on every table read here).
export default async function JourneyPage() {
  const profile = await getProfile();
  const activeDayCount = await getActiveDayCount(profile.id);

  // The member's own last 7 days (private, never-reportable). The date window is
  // computed in the member's own timezone; the reads run under the private
  // client, in the same guarded block as the reviews.
  const todayIso = todayISODate(new Date(), profile.timezone);
  const stepDates = lastNDates(todayIso, 7);

  let weeklyReviews: WeeklyReview[] | null = null;
  let periodicReviews: PeriodicReview[] | null = null;
  let stepEntries: StepEntry[] = [];
  let earnedBadges: EarnedBadge[] = [];
  // badge_keys the member has already shared to the wins board (public schema),
  // so each badge renders as "Share" or "Shared" rather than offering a duplicate.
  let sharedBadgeKeys = new Set<string>();
  // The member's own last-7-days sleep score / day rating, for the trend chart.
  // Private to them (their own page); never a gamification input, never reported.
  let dailySleep = new Map<string, number>();
  let dailyRating = new Map<string, number>();
  // The member's own Clean Streak summary for the rail entry card (private,
  // own-rows only). Defaults to "none" so any read failure just hides progress.
  let habitSummary: HabitEntrySummary = { hasAny: false, active: null };
  try {
    const supabase = await createClient("private");
    const publicClient = await createClient();

    // Every read on this screen fires in ONE wave. The reviews, steps, earned
    // badges, Clean Streak summary, the 7-day sleep/rating rows and the
    // already-shared badge keys are all independent, per-user reads -- there's
    // no data dependency between them, so awaiting them in six sequential rounds
    // (as this did) only stacked their latencies. Kept in the same guarded block
    // so any failure still degrades to the safe empty-history defaults above.
    const [
      weeklyResult,
      periodicResult,
      stepEntriesResult,
      earnedBadgesResult,
      habitSummaryResult,
      { data: sleepRows },
      { data: ratingRows },
      { data: sharedRows },
    ] = await Promise.all([
      supabase
        .from("weekly_reviews")
        .select("*")
        .eq("user_id", profile.id)
        .not("completed_at", "is", null)
        .order("week_start_date", { ascending: false }),
      supabase
        .from("periodic_reviews")
        .select("*")
        .eq("user_id", profile.id)
        .not("completed_at", "is", null),
      getRecentSteps(supabase, profile.id, stepDates[0]),
      getEarnedBadges(supabase, profile.id),
      getMyHabitEntrySummary(supabase, profile.id, todayIso),
      // Daily sleep + day-rating over the same 7-day window as steps.
      supabase.from("morning_entries").select("entry_date, sleep_score").eq("user_id", profile.id).in("entry_date", stepDates),
      supabase.from("night_entries").select("entry_date, day_rating").eq("user_id", profile.id).in("entry_date", stepDates),
      // Which badges are already on the wins board (public.community_posts).
      publicClient
        .from("community_posts")
        .select("shared_badge_key")
        .eq("user_id", profile.id)
        .not("shared_badge_key", "is", null)
        .eq("is_removed", false),
    ]);
    weeklyReviews = weeklyResult.data as WeeklyReview[] | null;
    periodicReviews = periodicResult.data as PeriodicReview[] | null;
    stepEntries = stepEntriesResult;
    earnedBadges = earnedBadgesResult;
    habitSummary = habitSummaryResult;
    dailySleep = new Map(
      (sleepRows ?? [])
        .filter((r) => r.sleep_score != null)
        .map((r) => [r.entry_date as string, r.sleep_score as number])
    );
    dailyRating = new Map(
      (ratingRows ?? [])
        .filter((r) => r.day_rating != null)
        .map((r) => [r.entry_date as string, r.day_rating as number])
    );
    sharedBadgeKeys = new Set((sharedRows ?? []).map((r) => r.shared_badge_key as string));
  } catch {
    weeklyReviews = null;
    periodicReviews = null;
    stepEntries = [];
    earnedBadges = [];
  }

  const stepsWeek = buildStepsWeek(stepDates, stepEntries);

  const reviews = (weeklyReviews as WeeklyReview[] | null) ?? [];
  const recentReviews = reviews.slice(0, 5);

  // The four remaining reads are independent (only the already-loaded weekly
  // reviews feed ratingsByWeek), so they run in one wave rather than four
  // sequential awaits: journey stats, the badge engagement snapshot, the
  // company step-challenge brief, and the per-week rating averages. The
  // step-challenge lookup keeps its own best-effort guard (a failure there just
  // hides the card) via the inline catch, so it can't reject the whole batch.
  const [stats, engagement, activeChallenge, ratingsByWeek] = await Promise.all([
    getJourneyStats(profile.id, activeDayCount),
    gatherEngagement(profile.id),
    (async (): Promise<{ id: string; title: string } | null> => {
      try {
        const publicClient = await createClient();
        return await getActiveChallengeBrief(publicClient, profile.company_id);
      } catch {
        return null;
      }
    })(),
    getWeeklyRatingAverages(profile.id, recentReviews.map((r) => r.week_start_date)),
  ]);

  // Full badge catalogue (earned + locked, in display order) evaluated against
  // the same engagement the Today screen uses, plus the earned-at dates for every
  // persisted badge -- including the awarded ones (Team MVP / Challenge Complete /
  // Clean Streak), which the Trophy Room shows as earned when a date is present.
  const badgeStats = badgeStatsFrom(engagement);
  const allBadges = evaluateBadges(badgeStats);
  const earnedAt = new Map(earnedBadges.map((b) => [b.badge_key, b.earned_at]));

  const now = new Date();
  const todayWeekday = weekdayNameOrWeekend(now, profile.timezone);
  const currentWeekMonday = getMondayOfWeek(now, profile.timezone);
  const weeklyReviewOpen = todayWeekday === "friday" || todayWeekday === "saturday" || todayWeekday === "sunday";
  const thisWeekDone = reviews.some((r) => r.week_start_date === currentWeekMonday);

  const review30 = (periodicReviews as PeriodicReview[] | null)?.find((r) => r.review_type === "30_day") ?? null;
  const review60 = (periodicReviews as PeriodicReview[] | null)?.find((r) => r.review_type === "60_day") ?? null;
  const review90 = (periodicReviews as PeriodicReview[] | null)?.find((r) => r.review_type === "90_day") ?? null;

  const dailyRatings = stepDates.map((d) => ({
    date: d,
    sleep: dailySleep.get(d) ?? null,
    dayRating: dailyRating.get(d) ?? null,
  }));
  const daysLogged = dailyRatings.filter((d) => d.sleep != null || d.dayRating != null).length;

  return (
    // The Journey board is a dark "ink" surface, matching the Today board. The
    // page's own <main> is a centered max-w column, so the ink scope + ground
    // sit on a full-width wrapper (otherwise the side gutters would stay light);
    // min-h-full fills the (app) shell's flex-1 content slot. Every child adapts
    // via the ground tokens the scope remaps (see globals.css).
    <div data-surface="ink" className="min-h-full bg-background text-foreground">
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">My Journey</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <span className="inline-block h-2.5 w-2.5 shrink-0 bg-brand-accent" aria-hidden />
            Only you can see this page. Not your employer, not NTITT.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Stat value={stats.daysIn} label="Days in" />
          <Stat value={stats.mornings} label="Mornings" />
          <Stat value={stats.nights} label="Nights" />
          <Stat value={stats.weeklyReviews} label="Reviews" />
        </div>
      </div>

      <div className="mt-8 border-t border-rule-hairline pt-8">
        <TrophyRoom
          badges={allBadges}
          statsInput={badgeStats}
          earnedAt={earnedAt}
          sharedKeys={sharedBadgeKeys}
          canShare={profile.community_opt_in}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-10 border-t border-rule-hairline pt-8 lg:grid-cols-[1fr_300px]">
        <div>
          <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Week by week</h2>
          {recentReviews.length === 0 && <p className="mt-4 text-sm text-muted">Nothing here yet — keep going.</p>}
          <div className="mt-2">
            {recentReviews.map((review, i) => {
              const highlight = pickHighlight(review, i);
              const ratings = ratingsByWeek.get(review.week_start_date);
              return (
                <div key={review.id} className="border-t border-rule-hairline py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep">
                        Week {stats.weeklyReviews - i} · {formatWeekRange(review.week_start_date)}
                      </p>
                      {highlight && (
                        <>
                          <p className="mt-2 text-lg font-extrabold leading-tight tracking-tight">{highlight.label}</p>
                          <p className="mt-1 text-sm text-muted">{highlight.value}</p>
                        </>
                      )}
                    </div>
                    {ratings?.avgDayRating != null && (
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-extrabold">{ratings.avgDayRating.toFixed(1)}</p>
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">avg day</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {daysLogged > 0 && (
            <div className="mt-8 border-t border-rule-hairline pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                  Sleep and day rating · last 7 days
                </h2>
                <div className="flex gap-3 text-[10px] font-extrabold uppercase tracking-[0.14em]">
                  <span className="text-foreground">■ Sleep</span>
                  <span className="text-brand-accent-deep">■ Day rating</span>
                </div>
              </div>
              <div className="mt-4 flex h-28 items-end gap-2">
                {dailyRatings.map((d) => (
                  <div
                    key={d.date}
                    className="flex flex-1 flex-col items-center gap-1.5"
                    aria-label={`${dowLabel(d.date)}: sleep ${d.sleep ?? "not logged"}, day rating ${d.dayRating ?? "not logged"}`}
                  >
                    <span className="flex h-full w-full items-end gap-0.5" aria-hidden>
                      <span className="flex-1 bg-foreground" style={{ height: `${((d.sleep ?? 0) / 10) * 100}%` }} />
                      <span className="flex-1 bg-brand-accent" style={{ height: `${((d.dayRating ?? 0) / 10) * 100}%` }} />
                    </span>
                    <span className="text-[10px] font-semibold uppercase text-muted" aria-hidden>
                      {dowLabel(d.date)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted">
                {daysLogged} {daysLogged === 1 ? "day" : "days"} logged. The pattern gets useful around day seven.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {activeChallenge && (
            <Link
              href="/step-challenge"
              className="block border border-rule-hairline p-4 transition-colors hover:bg-foreground/[0.03]"
            >
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Company challenge</p>
              <p className="mt-1 font-extrabold">{activeChallenge.title}</p>
              <p className="mt-1 text-sm font-semibold text-brand-accent-deep">See the team&apos;s progress →</p>
            </Link>
          )}

          {/* Clean Streak: the member's own habit-quit progress (private,
              own-rows only) with the entry point to /clean-streak. */}
          <CleanStreakEntryCard summary={habitSummary} />

          <div>
            <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Milestones</h2>
            <div className="mt-2 space-y-3">
              <MilestoneCard type="30_day" review={review30} activeDayCount={activeDayCount} />
              <MilestoneCard type="60_day" review={review60} activeDayCount={activeDayCount} locked={!review30} />
              <MilestoneCard type="90_day" review={review90} activeDayCount={activeDayCount} locked={!review60} />
            </div>
          </div>

          <div className="border-t border-rule-hairline pt-6">
            <StepsCard week={stepsWeek} />
          </div>

          {weeklyReviewOpen && (
            <div>
              <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">This weekend</h2>
              <div className="mt-2 border border-rule-hairline p-4 text-sm">
                <p className="font-extrabold">Weekly Review</p>
                <p className="mt-1 text-muted">Reflect, learn, and reset for the week ahead. Open from Friday.</p>
                {thisWeekDone ? (
                  <p className="mt-3 text-xs text-muted">Done for this week.</p>
                ) : (
                  <Link
                    href="/weekly-review"
                    className="mt-3 inline-block bg-brand-accent px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground"
                  >
                    Start review
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-3xl font-extrabold leading-none tracking-tight">{value}</p>
      <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">{label}</p>
    </div>
  );
}

function MilestoneCard({
  type,
  review,
  activeDayCount,
  locked,
}: {
  type: ReviewType;
  review: PeriodicReview | null;
  activeDayCount: number;
  locked?: boolean;
}) {
  if (review) {
    return (
      <div className="border border-rule-hairline p-4 text-sm">
        <p className="font-extrabold">{REVIEW_LABEL[type]}</p>
        <p className="mt-1 text-muted">Completed {review.period_end}</p>
        <Link
          href={REVIEW_ROUTES[type]}
          className="mt-2 inline-block text-xs font-extrabold uppercase tracking-wide text-brand-accent-deep"
        >
          Read it back →
        </Link>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="border border-rule-hairline p-4 text-sm">
        <p className="font-extrabold text-muted">{REVIEW_LABEL[type]}</p>
        <p className="mt-1 text-muted">Opens after your {REVIEW_PREREQUISITE_LABEL[type] ?? "previous review"}.</p>
      </div>
    );
  }

  const threshold = REVIEW_THRESHOLDS[type];
  const floor =
    type === "90_day" ? REVIEW_THRESHOLDS["60_day"] : type === "60_day" ? REVIEW_THRESHOLDS["30_day"] : 0;
  const progress = Math.min(Math.max((activeDayCount - floor) / (threshold - floor), 0), 1);
  const remaining = Math.max(threshold - activeDayCount, 0);

  return (
    // The active target: on the ink board a red border makes it the card that
    // pops (completed/locked milestones keep the neutral hairline outline),
    // mirroring the Today hero. bg-brand-background == the ink ground, so the
    // border does the defining work.
    <div className="border-2 border-brand-accent bg-brand-background p-4 text-sm text-brand-foreground">
      <p className="text-lg font-extrabold leading-tight tracking-tight">{REVIEW_LABEL[type]}</p>
      {remaining === 0 ? (
        <Link href={REVIEW_START_ROUTES[type]} className="mt-1 inline-block font-semibold text-brand-accent-light underline">
          Ready to complete →
        </Link>
      ) : (
        <p className="mt-1 text-muted-on-ink">{`${remaining} more active day${remaining === 1 ? "" : "s"} to go`}</p>
      )}
      <div className="mt-3 h-1.5 bg-white/15">
        <div className="h-full bg-brand-accent" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
