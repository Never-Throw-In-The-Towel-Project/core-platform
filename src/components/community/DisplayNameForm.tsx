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
        className="w-full border border-current/20 bg-transparent px-2 py-1.5 text-sm"
      />
      <p className="text-xs opacity-60">Change it any time. It doesn&apos;t have to be your real name.</p>
      {state.status === "error" && <p className="text-xs text-red-700">{state.message}</p>}
      {state.status === "success" && <p className="text-xs opacity-60">Saved.</p>}
      <button
        type="submit"
        disabled={isPending}
        className="border border-current/20 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
