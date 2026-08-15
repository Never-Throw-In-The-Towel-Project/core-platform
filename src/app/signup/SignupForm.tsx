"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/actions/signup";
import { initialRoutineState } from "@/lib/actions/routineState";
import { validateSignupFields } from "./validation";

export function SignupForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState(signUp, initialRoutineState);
  // Client-side pre-submit validation, surfaced as an inline message. Without
  // this, the browser's native `required`/`minLength` bubble silently blocks
  // the submit -- a mismatched password or unticked consent box made "Create
  // account" look like it did nothing. `noValidate` below hands validation to
  // this + the server action instead of the native popup.
  const [clientError, setClientError] = useState<string | null>(null);

  if (state.status === "success") {
    return (
      <p className="text-center text-foreground/80">
        Check your email to confirm your account.
      </p>
    );
  }

  function handleSubmit(formData: FormData) {
    const error = validateSignupFields({
      displayName: String(formData.get("displayName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
      consent: formData.get("consent") === "yes",
    });
    if (error) {
      setClientError(error);
      return;
    }
    setClientError(null);
    formAction(formData);
  }

  // The client catch takes precedence; fall back to the server action's own
  // message (e.g. a Supabase failure the client can't foresee).
  const message = clientError ?? (state.status === "error" ? state.message : null);

  return (
    <form action={handleSubmit} noValidate className="flex w-full max-w-sm flex-col gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      <label className="text-sm">
        Name
        <input
          name="displayName"
          type="text"
          required
          className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2.5"
        />
      </label>
      <label className="text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2.5"
        />
      </label>
      <label className="text-sm">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2.5"
        />
      </label>
      <label className="text-sm">
        Confirm password
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2.5"
        />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input name="consent" type="checkbox" required value="yes" className="mt-1 shrink-0" />
        <span>
          I agree to the{" "}
          <Link href="/terms" target="_blank" className="underline">Terms of Service</Link> and{" "}
          <Link href="/privacy" target="_blank" className="underline">Privacy Policy</Link>.
        </span>
      </label>
      {message && (
        <p role="alert" className="text-sm text-brand-accent-deep">
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-accent px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Creating account…" : "Create account"}
      </button>
      <Link href="/login" className="text-center text-sm text-muted underline hover:text-foreground">
        Already have an account? Sign in
      </Link>
    </form>
  );
}
