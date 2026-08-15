"use client";

import { useActionState, useState } from "react";
import { submitNightEntry } from "@/lib/actions/night";
import { initialRoutineState } from "@/lib/actions/routineState";

const DAY_SCALE = Array.from({ length: 10 }, (_, i) => i + 1);

export function NightRoutineForm({ initialSteps = null }: { initialSteps?: number | null }) {
  const [state, formAction, isPending] = useActionState(submitNightEntry, initialRoutineState);
  const [dayRating, setDayRating] = useState<number | null>(null);

  if (state.status === "success") {
    return (
      <div className="space-y-2 text-center">
        <p className="text-4xl">🌙</p>
        <h1 className="text-2xl font-extrabold tracking-tight">Good work today. Rest well.</h1>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">🌙 Night Routine</h1>
        <p className="text-muted-on-ink">Tomorrow is a new day, rest up and go again.</p>
      </header>

      <fieldset className="space-y-2 text-sm">
        <legend className="mb-1 font-medium">Evening checklist</legend>
        {[
          { name: "noPhoneBeforeBed", label: "No phone one hour before bed" },
          { name: "hotBathOrShower", label: "Hot bath or shower" },
        ].map((item) => (
          <label key={item.name} className="flex items-center gap-2">
            <input type="checkbox" name={item.name} value="true" />
            {item.label}
          </label>
        ))}
      </fieldset>

      <p className="border border-ink-hairline p-4 text-sm">
        Don&apos;t underestimate a comfy set of pyjamas.
      </p>

      <label className="block text-sm">
        <span className="font-medium">What&apos;s the one thing I&apos;m grateful for today?</span>
        <textarea
          name="gratitude"
          rows={2}
          className="mt-1 w-full border border-ink-hairline bg-transparent px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">What was the highlight of my day?</span>
        <textarea
          name="highlight"
          rows={2}
          className="mt-1 w-full border border-ink-hairline bg-transparent px-3 py-2"
        />
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Rate my day</legend>
        <div className="flex flex-wrap gap-2">
          {DAY_SCALE.map((n) => (
            <label key={n}>
              <input
                type="radio"
                name="dayRating"
                value={n}
                checked={dayRating === n}
                onChange={() => setDayRating(n)}
                className="peer sr-only"
                required
              />
              <span className="flex h-9 w-9 cursor-pointer items-center justify-center border border-ink-hairline text-sm peer-checked:bg-brand-accent peer-checked:text-brand-accent-foreground">
                {n}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-on-ink">Private to you. Never shared or reported.</p>
      </fieldset>

      <label className="block text-sm">
        <span className="font-medium">What am I looking forward to tomorrow?</span>
        <textarea
          name="lookingAhead"
          rows={2}
          className="mt-1 w-full border border-ink-hairline bg-transparent px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">
          Steps today <span className="font-normal text-muted-on-ink">(optional)</span>
        </span>
        <input
          type="number"
          name="steps"
          inputMode="numeric"
          min={0}
          max={200000}
          step={1}
          defaultValue={initialSteps ?? undefined}
          placeholder="e.g. 8,000"
          className="mt-1 w-full border border-ink-hairline bg-transparent px-3 py-2"
        />
        <span className="mt-1 block text-xs text-muted-on-ink">
          Private to you. Never shared or reported.
        </span>
      </label>

      <p className="text-center text-sm italic text-muted-on-ink">
        Tomorrow is a new day, rest up and go again.
      </p>

      {state.status === "error" && <p className="text-sm text-brand-accent-light">{state.message}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-brand-accent px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Complete Night Routine"}
      </button>
    </form>
  );
}
