"use client";

import { useActionState, useEffect, useRef } from "react";
import { initialRoutineState, type RoutineActionState } from "@/lib/actions/routineState";

type RevokeAction = (state: RoutineActionState, formData: FormData) => Promise<RoutineActionState>;

/**
 * Cancel a not-yet-accepted invite (E1). Reused on every invite surface; the
 * caller passes the role-scoped action (revokeEmployeeInvite / revokeStaffInvite).
 */
export function RevokePendingInviteForm({ action }: { action: RevokeAction }) {
  const [state, formAction, isPending] = useActionState(action, initialRoutineState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3 border border-rule-hairline p-4">
      <div>
        <h2 className="text-sm font-semibold">Revoke a pending invite</h2>
        <p className="mt-1 text-xs text-muted">
          Cancels an invite that hasn’t been accepted yet (e.g. sent to the wrong address), freeing the
          email to be re-invited. It has no effect on someone who has already signed in.
        </p>
      </div>
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
      {state.status === "success" && <p className="text-sm text-muted">Invite revoked.</p>}
      <button
        type="submit"
        disabled={isPending}
        className="border border-rule-border px-4 py-2 text-sm font-extrabold uppercase tracking-wide disabled:opacity-50"
      >
        {isPending ? "Revoking…" : "Revoke invite"}
      </button>
    </form>
  );
}
