import type { Weekday } from "@/types/database";
import { WeekStrip } from "./WeekStrip";
import { displayRankName, type Rank } from "@/lib/gamification/rank";

type DayKey = Weekday | "saturday" | "sunday";

/**
 * The ink progress band that heads the Today screen, per the brand-refresh
 * design: a day/week eyebrow, the user's rank and a single stat line
 * (streak · wins · badges) on the left; the seven-cell week strip and the
 * "to your next review" progress on the right. Every number here is derived
 * from the user's own engagement -- nothing private, nothing an employer ever
 * sees.
 */
export function ProgressBand({
  rank,
  streak,
  winsCount,
  badgesEarned,
  ringPct,
  daysToReview,
  reviewLabel,
  reviewComplete,
  activeDayCount,
  isoWeek,
  weekDaysIn,
  completedWeekdays,
  todayKey,
}: {
  rank: Rank;
  streak: number;
  winsCount: number;
  badgesEarned: number;
  ringPct: number;
  daysToReview: number;
  reviewLabel: string;
  reviewComplete: boolean;
  activeDayCount: number;
  isoWeek: number;
  weekDaysIn: number;
  completedWeekdays: Set<Weekday>;
  todayKey: DayKey;
}) {
  const reviewTarget = activeDayCount + daysToReview;

  return (
    <section className="bg-brand-background text-brand-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-light-2">
            Day {activeDayCount} · Week {isoWeek}
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-none tracking-tight sm:text-[28px]">
            {displayRankName(rank)}
          </h2>
          <p className="mt-1.5 text-sm text-muted-on-ink-2">
            {streak} day streak · {winsCount} wins · {badgesEarned} badges
          </p>
        </div>

        {/* The week + review progress -- the design moves both up here, off the
            light body rail, onto the ink band. */}
        <div className="w-full sm:max-w-[340px]">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-on-ink">The Week</h3>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-on-ink">
              {weekDaysIn} of 7 days in
            </span>
          </div>
          <div className="mt-2">
            <WeekStrip completedWeekdays={completedWeekdays} todayKey={todayKey} onDark />
          </div>

          <div className="mt-5 flex items-center justify-between">
            <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-on-ink">
              To {reviewLabel}
            </h3>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-on-ink">
              {reviewComplete ? "Complete" : `Day ${activeDayCount} / ${reviewTarget}`}
            </span>
          </div>
          <div
            className="mt-2 h-1.5 w-full bg-white/15"
            role="progressbar"
            aria-valuenow={ringPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress to your ${reviewLabel}`}
          >
            <div className="h-full bg-brand-accent-vivid transition-[width] duration-300 ease-out" style={{ width: `${Math.max(0, Math.min(100, ringPct))}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}
