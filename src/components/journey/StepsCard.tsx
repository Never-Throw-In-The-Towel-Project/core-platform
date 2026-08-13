"use client";

import { useActionState, useState } from "react";
import { logStepsAction } from "@/lib/actions/steps";
import { initialRoutineState } from "@/lib/actions/routineState";
import type { StepDay } from "@/lib/steps/week";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function dowLabel(iso: string): string {
  return DOW[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}
function short(steps: number): string {
  if (steps <= 0) return "–";
  return `${Math.round(steps / 100) / 10}k`;
}

/**
 * Self-reported steps: log today's count and see your own last 7 days. Steps are
 * a private, never-reportable health metric -- only the member ever sees this
 * (private schema + own-rows-only RLS on step_entries). The 7-day trend is not
 * colour-only: each bar carries its number and an aria-label, so a screen-reader
 * user gets the same data (the accessibility bar the Journey chart set).
 */
export function StepsCard({ week }: { week: StepDay[] }) {
  const today = week.length > 0 ? week[week.length - 1] : null;
  const [value, setValue] = useState(today && today.steps > 0 ? String(today.steps) : "");
  const [state, action, pending] = useActionState(logStepsAction, initialRoutineState);

  const max = Math.max(1, ...week.map((d) => d.steps));

  return (
    <section className="border border-rule-border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Daily steps</h2>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Private to you</span>
      </div>

      <form action={action} className="mt-3 flex gap-2">
        <label htmlFor="steps-input" className="sr-only">
          Today’s steps
        </label>
        <input
          id="steps-input"
          name="steps"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Today’s steps"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
          className="min-w-0 flex-1 border border-rule-border bg-transparent px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-accent px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
        >
          {pending ? "…" : "Log"}
        </button>
      </form>
      {state.status === "error" && <p className="mt-2 text-xs text-brand-accent-deep">{state.message}</p>}
      {state.status === "success" && (
        <p className="mt-2 text-xs font-semibold text-foreground" role="status">
          Saved — private to you.
        </p>
      )}

      {week.length > 0 && (
        <ul className="mt-4 flex items-end gap-1.5" aria-label="Your steps over the last 7 days">
          {week.map((day) => {
            const pct = day.steps > 0 ? Math.max(6, Math.round((day.steps / max) * 100)) : 0;
            return (
              <li
                key={day.date}
                className="flex min-w-0 flex-1 flex-col items-center gap-1"
                aria-label={`${dowLabel(day.date)}: ${day.steps.toLocaleString()} steps`}
              >
                <span className="text-[10px] font-semibold text-muted" aria-hidden="true">
                  {short(day.steps)}
                </span>
                <span className="flex h-14 w-full items-end" aria-hidden="true">
                  <span className="w-full bg-brand-accent" style={{ height: `${pct}%` }} />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted" aria-hidden="true">
                  {dowLabel(day.date)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
