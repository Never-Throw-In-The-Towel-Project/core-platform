"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { submitWorkoutWednesday } from "@/lib/actions/themedCheckin";
import { initialRoutineState } from "@/lib/actions/routineState";
import { RoutineComplete } from "./RoutineComplete";
import {
  WORKOUT_WEDNESDAY_REFLECTIONS,
  WORKOUT_WEDNESDAY_PBS,
} from "@/lib/routines/workoutWednesdayPrompts";
import type { ContentItem, WorkoutSetting } from "@/types/database";

const MODES: { value: WorkoutSetting; label: string }[] = [
  { value: "home", label: "Home workout" },
  { value: "gym", label: "Gym workout" },
];

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  return `${Math.round(seconds / 60)} min`;
}

/**
 * Workout Wednesday: pick where you're training today -- Home or Gym -- and the
 * matching physical-fitness videos from the Training library show, ready to
 * watch. The chosen mode is remembered week to week. Below sits the journal
 * ("Movement is medicine"): optional PB tracking + reflective prompts, the real
 * check-in payload. Both banks come from the library (listWorkoutVideos), so
 * there's no bespoke bank to seed and no "isn't loaded yet" dead end -- an
 * untagged mode simply shows a friendly pointer into Training.
 */
export function WorkoutWednesdayForm({
  home,
  gym,
  defaultMode,
}: {
  home: ContentItem[];
  gym: ContentItem[];
  defaultMode: WorkoutSetting | null;
}) {
  const [state, formAction, isPending] = useActionState(submitWorkoutWednesday, initialRoutineState);
  const [mode, setMode] = useState<WorkoutSetting>(defaultMode ?? "home");

  if (state.status === "success") {
    return <RoutineComplete title="Workout Wednesday complete. Nice work." />;
  }

  const videos = mode === "home" ? home : gym;

  return (
    <form action={formAction} className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Workout Wednesday</h1>
        <p className="text-muted">Move the body. Choose home or the gym, then log how it&apos;s going.</p>
      </header>

      {/* Home / Gym mode. Rides in a hidden input so it's saved with the
          check-in and comes back as the default next week. */}
      <input type="hidden" name="mode" value={mode} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Where are you training?</legend>
        <div className="flex border border-rule-border" role="group" aria-label="Workout location">
          {MODES.map((option) => {
            const active = mode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setMode(option.value)}
                className={`flex-1 px-4 py-3 text-sm font-extrabold uppercase tracking-wide transition-colors ${
                  active ? "bg-brand-accent text-brand-accent-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {videos.length === 0 ? (
        <div className="border border-rule-hairline p-4 text-sm text-muted">
          <p>No {mode === "home" ? "home" : "gym"} workouts here yet — new sessions land here as they&apos;re added.</p>
          <Link
            href="/content?category=physical_fitness"
            className="mt-2 inline-block font-semibold text-brand-accent-light underline"
          >
            Browse all Training →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {videos.map((item) => {
            const duration = formatDuration(item.duration_seconds);
            return (
              <li key={item.id}>
                <Link
                  href={`/content/${item.id}`}
                  className="group flex items-center justify-between gap-3 border border-rule-hairline p-4 transition-colors hover:border-foreground"
                >
                  <span className="min-w-0">
                    <span className="block font-extrabold leading-tight tracking-tight">{item.title}</span>
                    {duration && <span className="text-xs text-muted">{duration}</span>}
                  </span>
                  <span className="shrink-0 bg-brand-accent px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-brand-accent-foreground">
                    Watch
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
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
