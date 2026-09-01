"use client";

import { useActionState } from "react";
import { deleteAccount } from "@/lib/actions/account";
import { initialRoutineState } from "@/lib/actions/routineState";

/**
 * Right-to-erasure control. Collapsed by default and gated behind a typed
 * "DELETE" so it can't be triggered by accident. On success the server action
 * redirects to /login, so this only ever renders the idle/error state.
 */
export function DeleteAccountForm() {
  const [state, formAction, isPending] = useActionState(deleteAccount, initialRoutineState);

  return (
    <details className="border border-brand-accent/40 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-brand-accent-deep">Delete my account</summary>
      <p className="mt-2 text-xs text-muted">
        This permanently erases your account and all your private data (routines, reviews, scores, steps,
        badges and your community posts). It can&apos;t be undone.
      </p>
      <form action={formAction} className="mt-3 space-y-2">
        <label className="block text-sm">
          Type <span className="font-bold">DELETE</span> to confirm
          <input
            name="confirm"
            type="text"
            autoComplete="off"
            className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2.5"
          />
        </label>
        {state.status === "error" && <p className="text-xs text-brand-accent-deep">{state.message}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="bg-brand-accent px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
        >
          {isPending ? "Deleting…" : "Delete my account permanently"}
        </button>
      </form>
    </details>
  );
}
