"use client";

import { useActionState, useState } from "react";
import { submitMorningEntry } from "@/lib/actions/morning";
import { initialRoutineState } from "@/lib/actions/routineState";
import { RoutineComplete } from "./RoutineComplete";

const SLEEP_SCALE = Array.from({ length: 10 }, (_, i) => i + 1);

export function MorningRoutineForm() {
  const [state, formAction, isPending] = useActionState(submitMorningEntry, initialRoutineState);
  const [sleepScore, setSleepScore] = useState<number | null>(null);

  if (state.status === "success") {
    return <RoutineComplete title="Morning sorted. Go win the day." />;
  }

  return (
    <form action={formAction} className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">☀️ Morning Routine</h1>
        <p className="text-muted">Win the morning, win the day.</p>
      </header>

      <p className="border border-rule-hairline p-4 text-sm">
        Stay off your phone for 30 minutes in the morning.
      </p>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">How did I sleep?</legend>
        <div className="flex flex-wrap gap-2">
          {SLEEP_SCALE.map((n) => (
            <label key={n}>
              <input
                type="radio"
                name="sleepScore"
                value={n}
                checked={sleepScore === n}
                onChange={() => setSleepScore(n)}
                className="peer sr-only"
                required
              />
              <span className="flex h-9 w-9 cursor-pointer items-center justify-center border border-rule-border text-sm peer-checked:bg-brand-accent peer-checked:text-brand-accent-foreground">
                {n}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">Private to you. Never shared or reported.</p>
      </fieldset>

      <p className="border border-rule-hairline p-4 text-sm">
        Have a large glass of water BEFORE your morning coffee.
      </p>

      <fieldset className="space-y-2 text-sm">
        <legend className="mb-1 font-medium">Morning checklist</legend>
        {[
          { name: "morningWalk", label: "Morning walk" },
          { name: "breathwork", label: "Breathwork" },
          { name: "coldDip", label: "Cold dip or shower" },
        ].map((item) => (
          <label key={item.name} className="flex items-center gap-2">
            <input type="checkbox" name={item.name} value="true" />
            {item.label}
          </label>
        ))}
      </fieldset>

      <label className="block text-sm">
        <span className="font-medium">Power List -- what are my priorities for today?</span>
        <textarea
          name="powerList"
          rows={4}
          className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2"
        />
      </label>

      {state.status === "error" && <p className="text-sm text-brand-accent-deep">{state.message}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-brand-accent px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Complete Morning Routine"}
      </button>
    </form>
  );
}
