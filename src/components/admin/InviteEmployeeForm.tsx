"use client";

import { useActionState, useEffect, useRef } from "react";
import { inviteEmployee } from "@/lib/actions/invite";
import { initialRoutineState } from "@/lib/actions/routineState";

export function InviteEmployeeForm() {
  const [state, formAction, isPending] = useActionState(inviteEmployee, initialRoutineState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3 border border-rule-hairline p-4">
      <div>
        <h2 className="text-sm font-semibold">Invite an employee</h2>
        <p className="mt-1 text-xs text-muted">
          Sends a sign-in link. Their account is created for this company as soon as you send it.
        </p>
      </div>
      <label className="block text-sm">
        Name
        <input
          name="displayName"
          type="text"
          required
          maxLength={80}
          className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2"
        />
      </label>
      {state.status === "error" && <p className="text-sm text-brand-accent-deep">{state.message}</p>}
      {state.status === "success" && (
        <p className="text-sm text-muted">Invite sent.</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-accent px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send invite"}
      </button>
    </form>
  );
}
