import Link from "next/link";
import type { HabitEntrySummary } from "@/lib/habits/queries";

// The Clean Streak entry point on Today's rail and the Journey rail. Purely
// presentational (a server component -- no client JS); the pages fetch the
// summary. When a challenge is running it shows live progress in the success
// green; otherwise it's a quiet, discoverable nudge to start one. This is the
// only way into /clean-streak, so it renders in both the "active" and "none"
// cases rather than hiding when there's nothing running.
export function CleanStreakEntryCard({ summary }: { summary: HabitEntrySummary }) {
  const active = summary.active;

  if (active) {
    return (
      <Link
        href="/clean-streak"
        className="block border-2 border-foreground p-5 transition-colors hover:bg-success/[0.06]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Clean streak</h2>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Private to you</span>
        </div>

        <p className="mt-3 text-lg font-extrabold leading-tight tracking-tight">{active.habitLabel}</p>

        <div className="mt-3 flex items-end gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center bg-success text-success-foreground"
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 13l4 4L19 7" strokeLinecap="square" />
            </svg>
          </span>
          <div>
            <p className="text-2xl font-extrabold leading-none tracking-tight">
              {active.cleanDays}
              <span className="text-base text-muted"> / {active.targetDays} clean</span>
            </p>
            <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
              {active.isComplete
                ? "Goal reached"
                : active.currentStreak > 0
                  ? `${active.currentStreak} day streak`
                  : "Keep going"}
            </p>
          </div>
        </div>

        <div
          className="mt-3 h-1.5 w-full bg-foreground/10"
          role="progressbar"
          aria-valuenow={active.cleanDays}
          aria-valuemin={0}
          aria-valuemax={active.targetDays}
          aria-label={`${active.habitLabel}: ${active.cleanDays} of ${active.targetDays} clean days`}
        >
          <div className="h-full bg-success-vivid" style={{ width: `${active.percent}%` }} />
        </div>

        <p className="mt-4 text-xs font-extrabold uppercase tracking-wide text-brand-accent-deep">
          {active.isComplete ? "Celebrate it →" : "Mark today →"}
        </p>
      </Link>
    );
  }

  return (
    <Link
      href="/clean-streak"
      className="block border-2 border-foreground p-5 transition-colors hover:bg-success/[0.06]"
    >
      <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Clean streak</h2>
      <p className="mt-2 text-lg font-extrabold leading-tight tracking-tight">
        {summary.hasAny ? "Start a new clean streak." : "Stopping a bad habit?"}
      </p>
      <p className="mt-1.5 text-sm text-muted">
        Set your own goal — smoking, drinking, gambling — and mark every clean day. Private to you.
      </p>
      <p className="mt-4 text-xs font-extrabold uppercase tracking-wide text-brand-accent-deep">
        {summary.hasAny ? "Start again →" : "Start a streak →"}
      </p>
    </Link>
  );
}
