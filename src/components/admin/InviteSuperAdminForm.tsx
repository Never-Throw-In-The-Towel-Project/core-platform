"use client";

import { useActionState, useEffect, useRef } from "react";
import { inviteSuperAdmin } from "@/lib/actions/invite";
import { initialRoutineState } from "@/lib/actions/routineState";

/**
 * Invite another super admin by email (ntitt_admin only). Role and company are
 * fixed server-side (inviteSuperAdmin) -- this form carries only a name and an
 * email, deliberately, so it can never be repurposed to grant a different role.
 * Clears itself on a successful send.
 */
export function InviteSuperAdminForm() {
  const [state, formAction, isPending] = useActionState(inviteSuperAdmin, initialRoutineState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3 border border-rule-hairline p-4">
      <div>
        <h3 className="text-sm font-semibold">Invite a super admin</h3>
        <p className="mt-1 text-xs text-muted">
          Sends a sign-in link. Their account is created the moment you send it, with full Admin
          Centre access — invite only people you trust to manage every workspace.
        </p>
      </div>
      <label className="block text-sm">
        Name
        <input
          name="displayName"
          type="text"
          required
          maxLength={80}
          className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2 text-sm"
        />
      </label>
      {state.status === "error" && <p className="text-sm text-brand-accent-deep">{state.message}</p>}
      {state.status === "success" && (
        <p className="text-sm font-semibold text-foreground" role="status">
          Invite sent.
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-accent px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send invite"}
      </button>
    </form>
  );
}
