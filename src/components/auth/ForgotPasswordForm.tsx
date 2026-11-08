"use client";

import { useActionState } from "react";
import { requestPasswordReset, type PasswordResetRequestState } from "@/lib/actions/auth";

const initial: PasswordResetRequestState = { status: "idle" };

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, initial);

  if (state.status === "sent") {
    return (
      <p className="max-w-sm text-center text-foreground/80">
        If an account exists for that email, we’ve sent a link to set a new password. Check your inbox.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      <label className="text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2.5"
        />
      </label>
      {state.status === "error" && <p className="text-sm text-brand-accent-deep">{state.message}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-accent px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
