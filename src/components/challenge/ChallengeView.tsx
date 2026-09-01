import { daysRemaining, progressPercent, STEP_CHALLENGE_MIN_CONTRIBUTORS } from "@/lib/steps/challenge";
import type { StaffChallengeView } from "@/lib/steps/challengeQueries";
import { OptInToggle } from "./OptInToggle";

/**
 * The staff-facing company step challenge screen (brief §2): company name +
 * title, the team's collective progress, staff contributing, days left, the
 * reward, and the member's private opt-in toggle. It shows only the AGGREGATE --
 * never an individual. While the total is suppressed (below the k-anon floor)
 * the number is hidden with a friendly "building momentum" state rather than
 * revealing a near-single-person figure. Progress is not colour-only: the bar
 * carries an aria-valuenow and the number is stated in text.
 */
export function ChallengeView({ view, todayIso }: { view: StaffChallengeView; todayIso: string }) {
  const { challenge, companyName, totals, optedIn } = view;
  const daysLeft = daysRemaining(challenge.ends_on, todayIso);
  const suppressed = totals?.suppressed ?? true;
  const reached = totals?.target_reached ?? false;
  const contributors = totals?.contributor_count ?? 0;
  const total = totals?.total_steps ?? 0;
  const pct = progressPercent(total, challenge.target_steps);
  const target = challenge.target_steps.toLocaleString();

  return (
    <div className="space-y-6">
      <header>
        {companyName && (
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">{companyName}</p>
        )}
        <h1 className="mt-1 text-2xl font-extrabold uppercase">{challenge.title}</h1>
      </header>

      <section className="border border-rule-border p-5">
        {reached ? (
          <div>
            <p className="text-lg font-extrabold">Target smashed! 🎉</p>
            <p className="mt-1 text-sm text-muted">The team reached {target} steps together.</p>
          </div>
        ) : suppressed ? (
          <div>
            <p className="text-sm font-semibold">Building momentum…</p>
            <p className="mt-1 text-sm text-muted">
              The team total appears once at least {STEP_CHALLENGE_MIN_CONTRIBUTORS} people are contributing
              {contributors > 0 ? ` — ${contributors} so far.` : "."}
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold">
                {total.toLocaleString()} <span className="text-muted">of {target} steps</span>
              </p>
              <p className="text-sm font-extrabold">{pct}%</p>
            </div>
            <div
              className="mt-2 h-2 bg-rule-border"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Team progress: ${total.toLocaleString()} of ${target} steps`}
            >
              <div className="h-full bg-brand-accent" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </section>

      <dl className="grid grid-cols-2 gap-4">
        <div className="border border-rule-border p-4">
          <dt className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">Contributing</dt>
          <dd className="mt-1 text-2xl font-extrabold">
            {contributors} <span className="text-sm font-semibold text-muted">{contributors === 1 ? "person" : "people"}</span>
          </dd>
        </div>
        <div className="border border-rule-border p-4">
          <dt className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">Days left</dt>
          <dd className="mt-1 text-2xl font-extrabold">{daysLeft}</dd>
        </div>
      </dl>

      {/* Reward highlight. On the ink step-challenge board bg-brand-background
          equals the ground, so a red border defines it (and reads as the
          celebratory "unlock" accent). */}
      <section className="border border-brand-accent bg-brand-background p-5 text-brand-foreground">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] opacity-70">
          {reached ? "You unlocked" : "Hit the target and unlock"}
        </p>
        <p className="mt-1 text-lg font-extrabold">{challenge.reward_name}</p>
      </section>

      <OptInToggle challengeId={challenge.id} optedIn={optedIn} />
    </div>
  );
}
