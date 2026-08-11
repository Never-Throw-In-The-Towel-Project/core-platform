"use client";

import { useActionState } from "react";
import { updateDisplayName } from "@/lib/actions/settings";
import { initialRoutineState } from "@/lib/actions/routineState";

export function DisplayNameForm({ currentName }: { currentName: string }) {
  const [state, formAction, isPending] = useActionState(updateDisplayName, initialRoutineState);

  return (
    <form action={formAction} className="space-y-2">
      <input
        name="displayName"
        type="text"
        defaultValue={currentName}
        maxLength={40}
        required
        className="w-full border border-rule-border bg-transparent px-2 py-1.5 text-sm"
      />
      <p className="text-xs text-muted">Change it any time. It doesn&apos;t have to be your real name.</p>
      {state.status === "error" && <p className="text-xs text-brand-accent-deep">{state.message}</p>}
      {state.status === "success" && <p className="text-xs text-muted">Saved.</p>}
      <button
        type="submit"
        disabled={isPending}
        className="border border-rule-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
