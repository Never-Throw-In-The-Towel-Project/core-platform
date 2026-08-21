"use client";

import { useActionState, useState } from "react";
import { submitWorkoutWednesday } from "@/lib/actions/themedCheckin";
import { initialRoutineState } from "@/lib/actions/routineState";
import { RoutineComplete } from "./RoutineComplete";
import {
  WORKOUT_WEDNESDAY_REFLECTIONS,
  WORKOUT_WEDNESDAY_PBS,
} from "@/lib/routines/workoutWednesdayPrompts";
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
    return <RoutineComplete title="Workout Wednesday complete. Nice work." />;
  }

  return (
    <form action={formAction} className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Workout Wednesday</h1>
        <p className="text-muted">Move the body. 5 exercises, 40s work / 20s rest, repeat 4 times.</p>
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
              <span className="cursor-pointer border border-rule-border px-3 py-1.5 text-sm peer-checked:bg-brand-accent peer-checked:text-brand-accent-foreground">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {!workout || workout.exercises.length === 0 ? (
        <p className="border border-rule-hairline p-4 text-sm text-muted">
          This week&apos;s workout isn&apos;t loaded yet -- check back soon.
        </p>
      ) : (
        <ol className="space-y-3">
          {workout.exercises.map((exercise) => {
            const video = exercise.videos[tier];
            return (
              <li
                key={exercise.exercise_order}
                className="flex items-center justify-between border border-rule-hairline p-4 text-sm"
              >
                <span>
                  {exercise.exercise_order}. {exercise.exercise_name}
                </span>
                {video ? (
                  <a
                    href={`https://vimeo.com/${video.vimeo_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-muted"
                  >
                    Watch demo
                  </a>
                ) : (
                  <span className="text-xs text-muted">No demo yet</span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* Journal prompts, alongside the workout above -- movement is medicine.
          All optional: log a personal best, reflect on how training's going. */}
      <div className="space-y-5 border-t border-rule-hairline pt-5">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-deep">
          Movement is medicine
        </p>

        <fieldset className="space-y-3 text-sm">
          <legend className="mb-1 font-medium">Personal bests</legend>
          <div className="grid grid-cols-2 gap-3">
            {WORKOUT_WEDNESDAY_PBS.map((pb) => (
              <label key={pb.key} className="block">
                <span className="text-xs text-muted">{pb.label}</span>
                <input
                  name={pb.key}
                  type="text"
                  className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2"
                />
              </label>
            ))}
          </div>
        </fieldset>

        {WORKOUT_WEDNESDAY_REFLECTIONS.map((prompt) => (
          <label key={prompt.key} className="block text-sm">
            <span className="font-medium">{prompt.label}</span>
            <textarea
              name={prompt.key}
              rows={2}
              className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2"
            />
          </label>
        ))}
      </div>

      {state.status === "error" && <p className="text-sm text-brand-accent-deep">{state.message}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-brand-accent px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Complete Workout Wednesday"}
      </button>
    </form>
  );
}
