"use client";

import { useActionState } from "react";
import { submitSundaySetup } from "@/lib/actions/sundaySetup";
import { initialRoutineState } from "@/lib/actions/routineState";

const SUGGESTIONS = ["Gym kit ready", "Meals prepped", "Diary checked", "Alarm set"];

export function SundaySetupForm() {
  const [state, formAction, isPending] = useActionState(submitSundaySetup, initialRoutineState);

  if (state.status === "success") {
    return (
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Ready for Monday.</h1>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Sunday Setup</h1>
        <p className="opacity-80">A little prep goes a long way.</p>
      </header>

      <div className="space-y-2 text-sm">
        <p className="font-medium">Is there anything you can do today to make Monday easier?</p>
        <ul className="list-inside list-disc opacity-70">
          {SUGGESTIONS.map((suggestion) => (
            <li key={suggestion}>{suggestion}</li>
          ))}
        </ul>
      </div>

      <label className="block text-sm">
        <span className="font-medium">Notes for getting ready</span>
        <textarea
          name="prepNotes"
          rows={3}
          className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">One intention for the week ahead</span>
        <textarea
          name="intention"
          rows={2}
          className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2"
        />
      </label>

      {state.status === "error" && <p className="text-sm text-red-700">{state.message}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-brand-accent px-4 py-3 text-sm font-semibold text-brand-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save Sunday Setup"}
      </button>
    </form>
  );
}
