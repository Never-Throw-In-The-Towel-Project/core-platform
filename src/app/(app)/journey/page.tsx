import Link from "next/link";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getActiveDayCount } from "@/lib/routines/dayState";
import { getJourneyStats, getWeeklyRatingAverages } from "@/lib/routines/journey";
import { getMondayOfWeek, weekdayNameOrWeekend } from "@/lib/routines/dates";
import type { PeriodicReview, ReviewType, WeeklyReview } from "@/types/database";

const REVIEW_FIELDS: { key: keyof WeeklyReview; label: string }[] = [
  { key: "habits_to_double_down", label: "Which habits am I going to double down on?" },
  { key: "challenges_overcome", label: "What challenges did I overcome?" },
  { key: "lessons_learned", label: "What lessons did I learn this week?" },
  { key: "habits_served_well", label: "What habits served me well this week?" },
  { key: "challenges_helped_grow", label: "What challenges helped me grow?" },
  { key: "feels_better_from_habits", label: "Do I feel better from sticking to my positive habits?" },
  { key: "one_thing_to_improve", label: "What's one thing I can improve on that will help me move forward?" },
];

const REVIEW_THRESHOLDS: Record<ReviewType, number> = { "30_day": 30, "90_day": 90 };
const REVIEW_ROUTES: Record<ReviewType, string> = { "30_day": "/reviews/30-day/summary", "90_day": "/reviews/90-day/summary" };
// Same routes home's own pending-review redirect uses (src/app/(app)/home/page.tsx)
// to land someone on the fill-out form, not the read-back summary.
const REVIEW_START_ROUTES: Record<ReviewType, string> = { "30_day": "/reviews/30-day", "90_day": "/reviews/90-day" };
const REVIEW_LABEL: Record<ReviewType, string> = { "30_day": "30 Day Review", "90_day": "90 Day Review" };

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
// the 30/90-Day Reviews are a personal record the user can scroll back
// through over time, not just a one-time form. Read-only; only the user
// themselves can see this page (RLS is per-user on every table read here).
export default async function JourneyPage() {
  const profile = await getProfile();
  const activeDayCount = await getActiveDayCount(profile.id);
  const supabase = await createClient("private");

  const [{ data: weeklyReviews }, { data: periodicReviews }, stats] = await Promise.all([
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
    getJourneyStats(profile.id, activeDayCount),
  ]);

  const reviews = (weeklyReviews as WeeklyReview[] | null) ?? [];
  const recentReviews = reviews.slice(0, 5);
  const ratingsByWeek = await getWeeklyRatingAverages(
    profile.id,
    recentReviews.map((r) => r.week_start_date)
  );

  const now = new Date();
  const todayWeekday = weekdayNameOrWeekend(now, profile.timezone);
  const currentWeekMonday = getMondayOfWeek(now, profile.timezone);
  const weeklyReviewOpen = todayWeekday === "friday" || todayWeekday === "saturday" || todayWeekday === "sunday";
  const thisWeekDone = reviews.some((r) => r.week_start_date === currentWeekMonday);

  const review30 = (periodicReviews as PeriodicReview[] | null)?.find((r) => r.review_type === "30_day") ?? null;
  const review90 = (periodicReviews as PeriodicReview[] | null)?.find((r) => r.review_type === "90_day") ?? null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold uppercase">My Journey</h1>
          <p className="mt-1 text-sm opacity-70">Only you can see this page.</p>
        </div>
        <div className="flex gap-6 text-right">
          <Stat value={stats.daysIn} label="Days in" />
          <Stat value={stats.mornings} label="Mornings" />
          <Stat value={stats.nights} label="Nights" />
          <Stat value={stats.weeklyReviews} label="Weekly reviews" />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
        <div>
          <p className="text-xs font-semibold tracking-wide uppercase opacity-60">Week by week</p>
          {recentReviews.length === 0 && (
            <p className="mt-4 text-sm opacity-70">Nothing here yet -- keep going.</p>
          )}
          {recentReviews.map((review, i) => {
            const highlight = pickHighlight(review, i);
            const ratings = ratingsByWeek.get(review.week_start_date);
            return (
              <div key={review.id} className="border-t border-current/10 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-brand-accent">
                      WEEK {stats.weeklyReviews - i} · {formatWeekRange(review.week_start_date)}
                    </p>
                    {highlight && (
                      <>
                        <p className="mt-2 font-medium">{highlight.label}</p>
                        <p className="mt-1 text-sm opacity-80">{highlight.value}</p>
                      </>
                    )}
                  </div>
                  {ratings?.avgDayRating != null && (
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold">{ratings.avgDayRating.toFixed(1)}</p>
                      <p className="text-xs opacity-60">avg day</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {recentReviews.length > 0 && (
            <div className="mt-6 border-t border-current/10 pt-4">
              <p className="text-xs font-semibold tracking-wide uppercase opacity-60">
                Sleep and day rating · last {recentReviews.length} week{recentReviews.length === 1 ? "" : "s"}
              </p>
              <RatingsChart weeks={[...recentReviews].reverse().map((r) => ratingsByWeek.get(r.week_start_date))} />
              <div className="mt-2 flex gap-4 text-xs opacity-60">
                <span>▮ Sleep</span>
                <span className="text-brand-accent">▮ Day rating</span>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold tracking-wide uppercase opacity-60">Milestones</p>
            <div className="mt-2 space-y-3">
              <MilestoneCard type="30_day" review={review30} activeDayCount={activeDayCount} />
              <MilestoneCard
                type="90_day"
                review={review90}
                activeDayCount={activeDayCount}
                locked={!review30}
              />
            </div>
          </div>

          {weeklyReviewOpen && (
            <div>
              <p className="text-xs font-semibold tracking-wide uppercase opacity-60">This weekend</p>
              <div className="mt-2 border border-current/10 p-4 text-sm">
                <p className="font-semibold">Weekly Review</p>
                <p className="mt-1 opacity-70">Reflect, learn, and reset for the week ahead. Open from Friday.</p>
                {thisWeekDone ? (
                  <p className="mt-3 text-xs opacity-60">Done for this week.</p>
                ) : (
                  <Link
                    href="/weekly-review"
                    className="mt-3 inline-block bg-brand-accent px-4 py-2 text-sm font-semibold text-brand-accent-foreground"
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
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-2xl font-extrabold">{value}</p>
      <p className="text-xs opacity-60">{label}</p>
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
      <div className="border border-current/10 p-4 text-sm">
        <p className="font-semibold">{REVIEW_LABEL[type]}</p>
        <p className="mt-1 opacity-70">Completed {review.period_end}</p>
        <Link href={REVIEW_ROUTES[type]} className="mt-2 inline-block text-brand-accent underline">
          Read it back →
        </Link>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="border border-current/10 p-4 text-sm opacity-60">
        <p className="font-semibold">{REVIEW_LABEL[type]}</p>
        <p className="mt-1">Opens after your 30 Day Review.</p>
      </div>
    );
  }

  const threshold = REVIEW_THRESHOLDS[type];
  const floor = type === "90_day" ? REVIEW_THRESHOLDS["30_day"] : 0;
  const progress = Math.min(Math.max((activeDayCount - floor) / (threshold - floor), 0), 1);
  const remaining = Math.max(threshold - activeDayCount, 0);

  return (
    <div className="bg-brand-background p-4 text-sm text-brand-foreground">
      <p className="font-semibold">{REVIEW_LABEL[type]}</p>
      {remaining === 0 ? (
        <Link href={REVIEW_START_ROUTES[type]} className="mt-1 inline-block underline opacity-80">
          Ready to complete →
        </Link>
      ) : (
        <p className="mt-1 opacity-80">{`${remaining} more active day${remaining === 1 ? "" : "s"} to go`}</p>
      )}
      <div className="mt-3 h-1.5 bg-brand-foreground/20">
        <div className="h-full bg-brand-accent" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}

function RatingsChart({ weeks }: { weeks: ({ avgSleep: number | null; avgDayRating: number | null } | undefined)[] }) {
  return (
    <div className="mt-3 flex h-24 items-end gap-2">
      {weeks.map((week, i) => (
        <div key={i} className="flex flex-1 items-end gap-0.5">
          <div
            className="flex-1 bg-current/25"
            style={{ height: `${((week?.avgSleep ?? 0) / 10) * 100}%` }}
          />
          <div
            className="flex-1 bg-brand-accent"
            style={{ height: `${((week?.avgDayRating ?? 0) / 10) * 100}%` }}
          />
        </div>
      ))}
    </div>
  );
}
