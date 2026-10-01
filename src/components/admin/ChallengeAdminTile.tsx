import { optedInPercent, daysRemaining, rewardTypeLabel } from "@/lib/steps/challenge";
import type { AdminChallengeView } from "@/lib/steps/challengeQueries";

/**
 * The HR-admin view of the active step challenge: the team total, opt-in rate,
 * and whether the target is hit -- and nothing else. Consistent with the rest
 * of this dashboard, it shows company-wide aggregates only: never an individual
 * step count and never who has or hasn't opted in. When the total is suppressed
 * (below the k-anon floor) the number is withheld here too.
 */
export function ChallengeAdminTile({ view, todayIso }: { view: AdminChallengeView; todayIso: string }) {
  const { challenge, totals } = view;
  const daysLeft = daysRemaining(challenge.ends_on, todayIso);
  const target = challenge.target_steps.toLocaleString();

  return (
    <div className="border border-rule-border p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Active step challenge</p>
          <p className="mt-1 text-lg font-extrabold">{challenge.title}</p>
        </div>
        <span className="shrink-0 text-xs text-muted">{daysLeft} days left</span>
      </div>

      {!totals ? (
        <p className="mt-3 text-sm text-muted">
          Team progress updates daily — figures appear after the first day of logging.
        </p>
      ) : totals.suppressed ? (
        // k-anon floor (B2): withhold the contributor count too -- "(3 so far)"
        // at a small team identifies them, the very thing suppression protects.
        <p className="mt-3 text-sm text-muted">
          The team total appears once at least 5 staff are contributing.
        </p>
      ) : (
        <p className="mt-3 text-3xl font-extrabold">
          {totals.total_steps.toLocaleString()}
          <span className="text-lg font-semibold text-muted"> / {target} steps</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {/* k-anon floor (B2): the opt-in rate is opted_in/headcount, both of
            which are withheld (stored 0) below the floor -- showing "0%" would
            be misleading and the ratio itself is identifying at a tiny team, so
            it appears only once the total is shown. */}
        <span>
          <strong>{totals && !totals.suppressed ? `${optedInPercent(totals.opted_in_count, totals.headcount)}%` : "—"}</strong> of staff opted in
        </span>
        <span>{totals?.target_reached ? "🎉 Target reached" : "In progress"}</span>
      </div>

      <div className="mt-4 border-t border-rule-hairline pt-3">
        <p className="text-xs text-muted">
          Reward: {rewardTypeLabel(challenge.reward_type)} — {challenge.reward_name}
        </p>
        <p className="mt-1 text-xs text-muted">
          You see the team total and opt-in rate only — never individual steps or who opted in.
        </p>
      </div>
    </div>
  );
}
