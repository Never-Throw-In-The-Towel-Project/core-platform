"use client";

import { useActionState } from "react";
import { setChallengeOptInAction } from "@/lib/actions/stepChallenge";
import { initialRoutineState } from "@/lib/actions/routineState";

/**
 * The member's private opt-in control for a company step challenge. Default is
 * opted-in; opting out is a conscious choice and -- crucially -- private: the
 * copy says so, and it is true at the database (own-rows-only). Submitting flips
 * to the opposite of the current state; the page revalidates and re-renders with
 * the new state.
 */
export function OptInToggle({ challengeId, optedIn }: { challengeId: string; optedIn: boolean }) {
  const [state, action, pending] = useActionState(setChallengeOptInAction, initialRoutineState);

  return (
    <section className="border border-rule-border p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">
            {optedIn ? "You're contributing your steps to the team total." : "You're not contributing right now."}
          </p>
          <p className="mt-1 text-xs text-muted">
            Opting out is private — no one can see who has or hasn&apos;t opted in.
          </p>
        </div>
        <form action={action} className="shrink-0">
          <input type="hidden" name="challengeId" value={challengeId} />
          <input type="hidden" name="optedIn" value={optedIn ? "false" : "true"} />
          <button
            type="submit"
            disabled={pending}
            className="border border-rule-border px-4 py-2 text-xs font-extrabold uppercase tracking-wide disabled:opacity-50"
          >
            {pending ? "…" : optedIn ? "Opt out" : "Opt back in"}
          </button>
        </form>
      </div>
      {state.status === "error" && <p className="mt-2 text-xs text-brand-accent-deep">{state.message}</p>}
    </section>
  );
}
