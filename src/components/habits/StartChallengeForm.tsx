"use client";

import { useActionState, useState } from "react";
import { createHabitChallengeAction } from "@/lib/actions/habits";
import { initialRoutineState } from "@/lib/actions/routineState";

const PRESETS = [7, 14, 30, 90] as const;

// Start a new Clean Streak: what you're quitting + how long you're aiming for.
// The member picks their own length (a preset or a custom number); the action
// stamps started_on from their own timezone. Non-punitive from the first day --
// the copy stays encouraging, never clinical.
export function StartChallengeForm() {
  const [state, action, pending] = useActionState(createHabitChallengeAction, initialRoutineState);
  const [target, setTarget] = useState<number>(7);

  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="habitLabel" className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
          What are you quitting?
        </label>
        <input
          id="habitLabel"
          name="habitLabel"
          type="text"
          required
          maxLength={80}
          placeholder="Stop smoking"
          className="mt-2 w-full border-2 border-foreground bg-transparent px-3 py-2.5 text-base"
        />
        <p className="mt-1.5 text-xs text-muted">Only you ever see this. Say it however you like.</p>
      </div>

      <div>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">How many clean days?</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESETS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setTarget(days)}
              aria-pressed={target === days}
              className={
                "border-2 px-4 py-2 text-sm font-extrabold uppercase tracking-wide transition-colors " +
                (target === days
                  ? "border-foreground bg-foreground text-background"
                  : "border-rule-border text-foreground hover:border-foreground")
              }
            >
              {days} days
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="targetDays" className="text-sm text-muted">
            or set your own:
          </label>
          <input
            id="targetDays"
            name="targetDays"
            type="number"
            inputMode="numeric"
            min={1}
            max={366}
            required
            value={target}
            onChange={(e) => setTarget(Math.max(1, Math.min(366, Number(e.target.value) || 1)))}
            className="w-24 border-2 border-foreground bg-transparent px-3 py-2 text-sm"
          />
          <span className="text-sm text-muted">days</span>
        </div>
      </div>

      {state.status === "error" && <p className="text-sm font-semibold text-brand-accent-deep">{state.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="bg-success px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-success-foreground disabled:opacity-50"
      >
        {pending ? "Starting…" : "Start my clean streak"}
      </button>
    </form>
  );
}
