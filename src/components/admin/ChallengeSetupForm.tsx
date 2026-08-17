"use client";

import { useActionState } from "react";
import { createChallengeAction } from "@/lib/actions/stepChallengeAdmin";
import { initialRoutineState } from "@/lib/actions/routineState";
import { CHALLENGE_REWARD_TYPES } from "@/lib/steps/challenge";

/**
 * HR sets up a monthly team step challenge (brief §2). The reward is chosen,
 * funded, and administered by the company; the platform only displays it and
 * confirms when the target is hit. Staff choose whether to contribute (default
 * opted-in, opting out private) -- that's on the staff screen, not here.
 */
export function ChallengeSetupForm() {
  const [state, action, pending] = useActionState(createChallengeAction, initialRoutineState);

  return (
    <div className="border border-rule-border p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Start a step challenge</p>
      <p className="mt-1 text-sm text-muted">
        A collective team target — everyone who opts in contributes their daily steps. You see the team total
        and opt-in rate only, never individual steps or who opted in.
      </p>

      <form action={action} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium">Challenge title</span>
          <input
            name="title"
            required
            maxLength={120}
            placeholder="e.g. October Step Challenge"
            className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Team step target</span>
          <input
            name="targetSteps"
            type="number"
            inputMode="numeric"
            min={1}
            required
            placeholder="e.g. 50000000"
            className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Reward type</span>
          <select name="rewardType" required className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2">
            {CHALLENGE_REWARD_TYPES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="font-medium">Reward (shown to staff)</span>
          <input
            name="rewardName"
            required
            maxLength={200}
            placeholder="e.g. Team lunch on us"
            className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2"
          />
          <span className="mt-1 block text-xs text-muted">
            The prize is yours to choose, fund and host — we run the challenge and let you know the moment your
            team hits the target.
          </span>
        </label>

        <label className="block text-sm">
          <span className="font-medium">Starts</span>
          <input name="startsOn" type="date" required className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2" />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Ends</span>
          <input name="endsOn" type="date" required className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2" />
        </label>

        {state.status === "error" && (
          <p className="text-sm text-brand-accent-deep sm:col-span-2">{state.message}</p>
        )}
        {state.status === "success" && (
          <p className="text-sm font-semibold sm:col-span-2" role="status">
            {state.message ?? "Challenge launched — staff can now opt in and start contributing."}
          </p>
        )}

        <p className="text-xs text-muted sm:col-span-2">
          The challenge launches straight away and runs to your end date. Rewards are funded and administered by
          your company — the platform never handles prizes or payment.
        </p>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="bg-brand-accent px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
          >
            {pending ? "Launching…" : "Launch challenge"}
          </button>
        </div>
      </form>
    </div>
  );
}
