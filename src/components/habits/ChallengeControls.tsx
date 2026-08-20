"use client";

import { useActionState, useState } from "react";
import { extendHabitChallengeAction, setHabitStatusAction } from "@/lib/actions/habits";
import { initialRoutineState } from "@/lib/actions/routineState";

const PRESETS = [7, 14, 30, 60, 90] as const;

/**
 * The quieter controls under a running challenge: extend the goal (keep going),
 * or give it up. Extending is the encouraged path -- the presets jump past the
 * current target so a tap always lengthens the run. "Give it up" is deliberately
 * small and asks for a confirm; nothing here is destructive to the clean-day
 * history (a slip or an abandon never deletes the days already banked).
 */
export function ChallengeControls({
  challengeId,
  currentTarget,
}: {
  challengeId: string;
  currentTarget: number;
}) {
  const [extendState, extendAction, extendPending] = useActionState(extendHabitChallengeAction, initialRoutineState);
  const [statusState, statusAction, statusPending] = useActionState(setHabitStatusAction, initialRoutineState);
  const [target, setTarget] = useState<number>(nextPreset(currentTarget));

  return (
    <div className="space-y-6">
      <form action={extendAction} className="space-y-3">
        <input type="hidden" name="id" value={challengeId} />
        <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Extend the goal</span>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setTarget(days)}
              aria-pressed={target === days}
              disabled={days === currentTarget}
              className={
                "border-2 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide transition-colors disabled:opacity-30 " +
                (target === days
                  ? "border-foreground bg-foreground text-background"
                  : "border-rule-border text-foreground hover:border-foreground")
              }
            >
              {days}
            </button>
          ))}
          <input
            name="targetDays"
            type="number"
            inputMode="numeric"
            min={1}
            max={366}
            value={target}
            onChange={(e) => setTarget(Math.max(1, Math.min(366, Number(e.target.value) || 1)))}
            aria-label="New goal in days"
            className="w-20 border-2 border-foreground bg-transparent px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={extendPending || target === currentTarget}
            className="bg-success px-4 py-1.5 text-xs font-extrabold uppercase tracking-wide text-success-foreground disabled:opacity-50"
          >
            {extendPending ? "Saving…" : "Set new goal"}
          </button>
        </div>
        {extendState.status === "error" && (
          <p className="text-sm font-semibold text-brand-accent-deep">{extendState.message}</p>
        )}
        {extendState.status === "success" && <p className="text-sm text-muted">Goal updated. Keep going.</p>}
      </form>

      <form
        action={statusAction}
        onSubmit={(e) => {
          if (!confirm("Give up this streak? Your clean days stay in your history — you can start again any time.")) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={challengeId} />
        <input type="hidden" name="status" value="abandoned" />
        <button
          type="submit"
          disabled={statusPending}
          className="text-xs font-extrabold uppercase tracking-wide text-muted underline hover:text-brand-accent-deep disabled:opacity-50"
        >
          {statusPending ? "…" : "Give it up"}
        </button>
        {statusState.status === "error" && (
          <p className="mt-2 text-sm font-semibold text-brand-accent-deep">{statusState.message}</p>
        )}
      </form>
    </div>
  );
}

/** The smallest preset strictly greater than the current target (so "extend"
 *  always lengthens); falls back to the current + a bump when already past 90. */
function nextPreset(current: number): number {
  const higher = PRESETS.find((p) => p > current);
  return higher ?? Math.min(366, current + 30);
}
