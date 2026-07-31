"use client";

import { useActionState } from "react";
import { inviteEmployee } from "@/lib/actions/invite";
import { initialRoutineState } from "@/lib/actions/routineState";

export function InviteEmployeeForm() {
  const [state, formAction, isPending] = useActionState(inviteEmployee, initialRoutineState);

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-white/10 p-4">
      <div>
        <h2 className="text-sm font-semibold">Invite an employee</h2>
        <p className="mt-1 text-xs opacity-60">
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
          className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
        />
      </label>
      {state.status === "error" && <p className="text-sm text-red-400">{state.message}</p>}
      {state.status === "success" && (
        <p className="text-sm opacity-60">Invite sent.</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-brand-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send invite"}
      </button>
    </form>
  );
}
