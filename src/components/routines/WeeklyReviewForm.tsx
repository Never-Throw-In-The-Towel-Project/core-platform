"use client";

import { useActionState } from "react";
import { submitWeeklyReview } from "@/lib/actions/weeklyReview";
import { initialRoutineState } from "@/lib/actions/routineState";

const FIELDS: { key: string; label: string }[] = [
  { key: "habitsServedWell", label: "What habits served me well this week?" },
  { key: "challengesHelpedGrow", label: "What challenges helped me grow?" },
  { key: "lessonsLearned", label: "What lessons did I learn this week?" },
  { key: "challengesOvercome", label: "What challenges did I overcome, and what did they teach me?" },
  { key: "feelsBetterFromHabits", label: "Do I feel better from sticking to my positive habits?" },
  { key: "oneThingToImprove", label: "What's one thing I can improve on that will help me move forward?" },
  { key: "habitsToDoubleDown", label: "Which habits am I going to double down on to continue the momentum?" },
];

export function WeeklyReviewForm() {
  const [state, formAction, isPending] = useActionState(submitWeeklyReview, initialRoutineState);

  if (state.status === "success") {
    return (
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Weekly Review saved.</h1>
        <p className="opacity-80">Reflect, learn, and reset for the week ahead.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <header className="text-center">
        <h1 className="text-2xl font-bold">Weekly Review</h1>
        <p className="opacity-80">Reflect, learn, and reset for the week ahead.</p>
      </header>

      {FIELDS.map((field) => (
        <label key={field.key} className="block text-sm">
          <span className="font-medium">{field.label}</span>
          <textarea
            name={field.key}
            rows={2}
            className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2"
          />
        </label>
      ))}

      {state.status === "error" && <p className="text-sm text-red-700">{state.message}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-brand-accent px-4 py-3 text-sm font-semibold text-brand-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save Weekly Review"}
      </button>
    </form>
  );
}
