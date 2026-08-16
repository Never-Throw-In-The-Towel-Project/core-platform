"use client";

import { useActionState } from "react";
import { updateDisplayName } from "@/lib/actions/settings";
import { initialRoutineState } from "@/lib/actions/routineState";

/**
 * The settings-card display-name editor, shared by the member, HR and super
 * admin settings pages. Same updateDisplayName action as the Community right
 * rail; styled to match TimezoneForm/NotificationTimesForm rather than the
 * compact rail form.
 */
export function DisplayNameForm({ currentName }: { currentName: string }) {
  const [state, formAction, isPending] = useActionState(updateDisplayName, initialRoutineState);

  return (
    <form action={formAction} className="space-y-3 border border-rule-hairline p-4">
      <div>
        <label htmlFor="displayName" className="text-sm font-medium">
          Display name
        </label>
        <p className="mt-1 text-xs text-muted">
          How you appear to others in the community. It doesn&apos;t have to be your real name.
        </p>
      </div>
      <input
        id="displayName"
        name="displayName"
        type="text"
        defaultValue={currentName}
        maxLength={40}
        required
        className="w-full border border-rule-border bg-transparent px-3 py-2.5 text-sm"
      />
      {state.status === "error" && <p className="text-sm text-brand-accent-deep">{state.message}</p>}
      {state.status === "success" && <p className="text-sm font-semibold text-foreground">Saved.</p>}
      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-accent px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
