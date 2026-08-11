import { ProgressRing } from "./ProgressRing";
import { StoryRail, type Story } from "./StoryRail";
import type { Rank } from "@/lib/gamification/rank";

/**
 * The ink progress band that heads the Today screen: the review ring, the
 * user's rank and a single stat line (streak · wins · badges), with the story
 * rail on the right. Every number here is derived from the user's own
 * engagement -- nothing private, nothing an employer ever sees.
 */
export function ProgressBand({
  ringPct,
  rank,
  streak,
  winsCount,
  badgesEarned,
  daysToReview,
  reviewLabel,
  reviewComplete,
  stories,
}: {
  ringPct: number;
  rank: Rank;
  streak: number;
  winsCount: number;
  badgesEarned: number;
  daysToReview: number;
  reviewLabel: string;
  reviewComplete: boolean;
  stories: Story[];
}) {
  return (
    <section className="bg-brand-background text-brand-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <ProgressRing pct={ringPct} label={`toward your ${reviewLabel}`} />
          <div>
            <h2 className="text-2xl font-extrabold leading-none tracking-tight sm:text-[28px]">
              {rank.name}
            </h2>
            <p className="mt-1.5 text-sm text-muted-on-ink-2">
              {streak} day streak · {winsCount} wins · {badgesEarned} badges
            </p>
            <p className="mt-0.5 text-xs text-muted-on-ink">
              {reviewComplete
                ? "Both reviews complete"
                : `${daysToReview} ${daysToReview === 1 ? "day" : "days"} to your ${reviewLabel}`}
            </p>
          </div>
        </div>
        <StoryRail stories={stories} />
      </div>
    </section>
  );
}
