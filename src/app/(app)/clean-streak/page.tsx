import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { todayISODate } from "@/lib/routines/dates";
import {
  listMyHabitChallenges,
  listCheckInsForChallenge,
} from "@/lib/habits/queries";
import { computeHabitProgress } from "@/lib/habits/progress";
import { StartChallengeForm } from "@/components/habits/StartChallengeForm";
import { HabitCalendar } from "@/components/habits/HabitCalendar";
import { ChallengeControls } from "@/components/habits/ChallengeControls";
import { ShareWinComposer } from "@/components/habits/ShareWinComposer";
import type { HabitChallenge, HabitCheckIn } from "@/types/database";

export const metadata = { title: "Clean streak" };

function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// The Clean Streak home: a member's own habit-quit challenge. Private, own-rows
// only (the reads run under createClient("private"); RLS scopes every row to the
// caller). Non-punitive throughout -- progress is the COUNT of clean days, a slip
// is a dated note that never subtracts. No employer or admin ever sees this page.
export default async function CleanStreakPage() {
  const profile = await getProfile();
  const todayIso = todayISODate(new Date(), profile.timezone);

  let challenges: HabitChallenge[] = [];
  let activeCheckIns: HabitCheckIn[] = [];
  const active = { current: null as HabitChallenge | null };

  try {
    const supabase = await createClient("private");
    challenges = await listMyHabitChallenges(supabase, profile.id);
    active.current = challenges.find((c) => c.status === "active") ?? null;
    if (active.current) {
      activeCheckIns = await listCheckInsForChallenge(supabase, profile.id, active.current.id);
    }
  } catch {
    // Degrade to the empty state rather than crashing the page.
  }

  const past = challenges.filter((c) => c.status !== "active");
  const current = active.current;
  const progress = current ? computeHabitProgress(current.target_days, activeCheckIns, todayIso) : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header>
        <h1 className="text-4xl font-extrabold tracking-tight">Clean streak</h1>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted">
          <span className="inline-block h-2.5 w-2.5 shrink-0 bg-success" aria-hidden />
          Only you can see this. Not your employer, not NTITT.
        </p>
      </header>

      {current && progress ? (
        <div className="mt-8 space-y-8">
          {/* Progress summary */}
          <section className="border-2 border-foreground p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Quitting</p>
                <p className="mt-1 text-2xl font-extrabold leading-tight tracking-tight">{current.habit_label}</p>
                <p className="mt-1 text-sm text-muted">Started {longDate(current.started_on)}</p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-extrabold leading-none tracking-tight text-success">
                  {progress.cleanDays}
                </p>
                <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                  of {current.target_days} clean days
                </p>
              </div>
            </div>

            <div
              className="mt-5 h-2.5 w-full bg-foreground/10"
              role="progressbar"
              // Clamp to the max: clean days can exceed the goal once complete
              // (you can keep marking), but aria-valuenow > aria-valuemax is
              // invalid ARIA. The label still reports the true count.
              aria-valuenow={Math.min(progress.cleanDays, current.target_days)}
              aria-valuemin={0}
              aria-valuemax={current.target_days}
              aria-label={`${progress.cleanDays} of ${current.target_days} clean days`}
            >
              <div className="h-full bg-success-vivid" style={{ width: `${progress.percent}%` }} />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-4 border-t border-rule-hairline pt-5">
              <Stat value={progress.currentStreak} label="Day streak" />
              <Stat value={progress.longestStreak} label="Best run" />
              <Stat
                // Once complete, "remaining" is always 0 -- show days BEYOND the
                // goal instead (clean days minus target); otherwise days to go.
                value={progress.isComplete ? progress.cleanDays - current.target_days : progress.remaining}
                label={progress.isComplete ? "Days over goal" : "Days to go"}
                over={progress.isComplete}
              />
            </div>
          </section>

          {progress.isComplete && (
            <>
              <section className="bg-success p-6 text-success-foreground">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-success-foreground/80">
                  Goal reached
                </p>
                <p className="mt-2 text-2xl font-extrabold leading-tight tracking-tight">
                  {current.target_days} clean days. That&rsquo;s a win.
                </p>
                <p className="mt-2 text-sm text-success-foreground/90">
                  Keep the run going by extending your goal below — or take the win to the Wins Board when you&rsquo;re
                  ready. Sharing is always your choice, and never mentions what you were quitting.
                </p>
                <p className="mt-3 text-sm font-semibold text-success-foreground/90">
                  You&rsquo;ve earned the Clean Streak badge — find it on your Journey.
                </p>
              </section>

              <ShareWinComposer canShare={profile.community_opt_in} authorName={profile.display_name} />
            </>
          )}

          {/* Calendar */}
          <section className="border-2 border-foreground p-6">
            <HabitCalendar
              challengeId={current.id}
              startedOn={current.started_on}
              todayIso={todayIso}
              marks={activeCheckIns.map((c) => ({ check_in_date: c.check_in_date, outcome: c.outcome }))}
            />
          </section>

          {/* Controls */}
          <section className="border-2 border-foreground p-6">
            <ChallengeControls challengeId={current.id} currentTarget={current.target_days} />
          </section>
        </div>
      ) : (
        <section className="mt-8 border-2 border-foreground p-6">
          <h2 className="text-xl font-extrabold tracking-tight">
            {past.length > 0 ? "Start a new clean streak" : "Start your clean streak"}
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            Pick what you&rsquo;re quitting and set your own goal. Every clean day is a green tick — a slip never wipes
            out the days you&rsquo;ve banked.
          </p>
          <div className="mt-6">
            <StartChallengeForm />
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="mt-10 border-t border-rule-hairline pt-8">
          <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Past streaks</h2>
          <ul className="mt-3 divide-y divide-rule-hairline">
            {past.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-extrabold">{c.habit_label}</p>
                  <p className="text-sm text-muted">
                    {c.status === "completed" ? "Completed" : "Given up"} · goal {c.target_days} days · started{" "}
                    {longDate(c.started_on)}
                  </p>
                </div>
                <span
                  className={
                    "shrink-0 text-[10px] font-extrabold uppercase tracking-[0.14em] " +
                    (c.status === "completed" ? "text-success" : "text-muted")
                  }
                >
                  {c.status === "completed" ? "Won" : "Ended"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Stat({ value, label, over }: { value: number; label: string; over?: boolean }) {
  return (
    <div>
      <p className={"text-2xl font-extrabold leading-none tracking-tight" + (over ? " text-success" : "")}>
        {over && value > 0 ? `+${value}` : value}
      </p>
      <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">{label}</p>
    </div>
  );
}
