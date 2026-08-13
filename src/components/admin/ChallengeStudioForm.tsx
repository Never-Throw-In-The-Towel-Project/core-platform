"use client";

import { useActionState, useEffect, useRef } from "react";
import { createChallenge } from "@/lib/actions/challenges";
import { initialRoutineState } from "@/lib/actions/routineState";

const LABEL = "block text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted";
const FIELD = "mt-1 w-full border border-rule-border bg-transparent px-3 py-2 text-sm";

/**
 * The Studio's "new challenge" composer -- create the programme definition
 * (title, theme, length), then add its days on the challenge's own editor page.
 * ntitt_admin only; enforced again server-side and by RLS.
 */
export function ChallengeStudioForm() {
  const [state, formAction, isPending] = useActionState(createChallenge, initialRoutineState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-5 border border-rule-border p-5">
      <div>
        <label htmlFor="challenge-title" className={LABEL}>
          Title
        </label>
        <input id="challenge-title" name="title" required maxLength={200} className={FIELD} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="challenge-category" className={LABEL}>
            Theme
          </label>
          <select id="challenge-category" name="category" defaultValue="mental_fitness" className={FIELD}>
            <option value="mental_fitness">Mental Fitness</option>
            <option value="physical_fitness">Physical Fitness</option>
            <option value="nutrition">Nutrition</option>
            <option value="tools_tips">Tools &amp; Tips</option>
          </select>
        </div>
        <div>
          <label htmlFor="challenge-length" className={LABEL}>
            Length (days)
          </label>
          <input
            id="challenge-length"
            name="lengthDays"
            type="number"
            min={1}
            max={366}
            defaultValue={28}
            required
            inputMode="numeric"
            className={FIELD}
          />
        </div>
      </div>

      <div>
        <label htmlFor="challenge-summary" className={LABEL}>
          Summary <span className="font-semibold normal-case tracking-normal text-muted">(optional)</span>
        </label>
        <textarea id="challenge-summary" name="summary" rows={2} maxLength={1000} className={`${FIELD} resize-y`} />
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="publish" value="true" className="h-4 w-4" />
        Publish now (leave unchecked to keep it a draft while you add days)
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-brand-accent px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Create challenge"}
        </button>
        {state.status === "error" && <p className="text-sm text-brand-accent-deep">{state.message}</p>}
        {state.status === "success" && (
          <p className="text-sm font-semibold text-foreground" role="status">
            Created — open it below to add days.
          </p>
        )}
      </div>
    </form>
  );
}
