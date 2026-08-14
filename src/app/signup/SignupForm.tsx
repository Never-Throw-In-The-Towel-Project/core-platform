"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/actions/signup";
import { initialRoutineState } from "@/lib/actions/routineState";

export function SignupForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState(signUp, initialRoutineState);

  if (state.status === "success") {
    return (
      <p className="text-center text-foreground/80">
        Check your email to confirm your account.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      <label className="text-sm">
        Name
        <input
          name="displayName"
          type="text"
          required
          className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2"
        />
      </label>
      <label className="text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2"
        />
      </label>
      <label className="text-sm">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2"
        />
      </label>
      <label className="text-sm">
        Confirm password
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2"
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
      {state.status === "error" && <p className="text-sm text-red-700">{state.message}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-brand-accent px-4 py-2 font-semibold text-brand-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Creating account…" : "Create account"}
      </button>
      <Link href="/login" className="text-center text-sm opacity-70 underline">
        Already have an account? Sign in
      </Link>
    </form>
  );
}
