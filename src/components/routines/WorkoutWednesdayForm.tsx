"use client";

import { useActionState, useState } from "react";
import { submitWorkoutWednesday } from "@/lib/actions/themedCheckin";
import { initialRoutineState } from "@/lib/actions/routineState";
import type { WeekWorkout } from "@/lib/routines/workouts";
import type { WorkoutTier } from "@/types/database";

const TIERS: { value: WorkoutTier; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "elite", label: "Elite" },
];

export function WorkoutWednesdayForm({
  workout,
  defaultTier,
}: {
  workout: WeekWorkout | null;
  defaultTier: WorkoutTier | null;
}) {
  const [state, formAction, isPending] = useActionState(submitWorkoutWednesday, initialRoutineState);
  const [tier, setTier] = useState<WorkoutTier>(defaultTier ?? "beginner");

  if (state.status === "success") {
    return (
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Workout Wednesday complete. Nice work.</h1>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Workout Wednesday</h1>
        <p className="opacity-80">Move the body. 5 exercises, 40s work / 20s rest, repeat 4 times.</p>
      </header>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Choose your level</legend>
        <div className="flex flex-wrap gap-2">
          {TIERS.map((option) => (
            <label key={option.value}>
              <input
                type="radio"
                name="tier"
                value={option.value}
                checked={tier === option.value}
                onChange={() => setTier(option.value)}
                className="peer sr-only"
                required
              />
              <span className="cursor-pointer rounded-full border border-white/20 px-3 py-1.5 text-sm peer-checked:bg-brand-accent peer-checked:text-white">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {!workout || workout.exercises.length === 0 ? (
        <p className="rounded-lg border border-white/10 p-4 text-sm opacity-80">
          This week&apos;s workout isn&apos;t loaded yet -- check back soon.
        </p>
      ) : (
        <ol className="space-y-3">
          {workout.exercises.map((exercise) => {
            const video = exercise.videos[tier];
            return (
              <li
                key={exercise.exercise_order}
                className="flex items-center justify-between rounded-lg border border-white/10 p-4 text-sm"
              >
                <span>
                  {exercise.exercise_order}. {exercise.exercise_name}
                </span>
                {video ? (
                  <a
                    href={`https://vimeo.com/${video.vimeo_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline opacity-80"
                  >
                    Watch demo
                  </a>
                ) : (
                  <span className="text-xs opacity-50">No demo yet</span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {state.status === "error" && <p className="text-sm text-red-400">{state.message}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-brand-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Complete Workout Wednesday"}
      </button>
    </form>
  );
}
