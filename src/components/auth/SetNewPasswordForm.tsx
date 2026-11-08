"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { setPassword, type SetPasswordState } from "@/lib/actions/auth";

const initial: SetPasswordState = { status: "idle" };

/**
 * Set or change the account password (reuses the `setPassword` action, which
 * requires a session). Used by the recovery landing (/reset-password, with
 * `redirectTo`) and by account settings (inline success).
 */
export function SetNewPasswordForm({
  heading,
  helpText,
  submitLabel = "Update password",
  redirectTo,
}: {
  heading?: string;
  helpText?: string;
  submitLabel?: string;
  redirectTo?: string;
}) {
  const [state, formAction, isPending] = useActionState(setPassword, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      if (redirectTo) router.replace(redirectTo);
    }
  }, [state, redirectTo, router]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3 border border-rule-hairline p-4">
      {heading && <h2 className="text-sm font-semibold">{heading}</h2>}
      {helpText && <p className="text-xs text-muted">{helpText}</p>}
      <label className="block text-sm">
        New password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        Confirm new password
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2"
        />
      </label>
      {state.status === "error" && <p className="text-sm text-brand-accent-deep">{state.message}</p>}
      {state.status === "success" && !redirectTo && <p className="text-sm text-muted">Password updated.</p>}
      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-accent px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
