import Link from "next/link";

/**
 * The "to your next review" progress bar in the Today right rail. Track is a
 * hairline, fill is the vivid accent (decorative, no text on it). The 30- and
 * 90-day reviews are auto-triggered at their thresholds (see
 * lib/routines/periodicReview.ts), so before then this links to the user's
 * Journey, where the milestone cards live, rather than to a review route that
 * isn't open yet.
 */
export function ReviewProgress({
  pct,
  daysToReview,
  reviewLabel,
  reviewComplete,
}: {
  pct: number;
  daysToReview: number;
  reviewLabel: string;
  reviewComplete: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
        To {reviewLabel}
      </p>
      <div className="mt-2 h-1.5 w-full bg-rule-hairline">
        <div
          className="h-full bg-brand-accent-vivid transition-[width] duration-300 ease-out"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
      <p className="mt-2 text-sm">
        {reviewComplete ? (
          <Link href="/journey" className="font-extrabold text-brand-accent-deep underline">
            Both reviews done — see your journey →
          </Link>
        ) : (
          <Link href="/journey" className="font-semibold text-brand-accent-deep underline">
            {daysToReview} {daysToReview === 1 ? "day" : "days"} to your {reviewLabel} — see your journey →
          </Link>
        )}
      </p>
    </div>
  );
}
