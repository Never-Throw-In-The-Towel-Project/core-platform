"use client";

import { useActionState } from "react";
import { signInWithMagicLink, type MagicLinkState } from "@/lib/actions/auth";

const initialState: MagicLinkState = { status: "idle" };

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState(signInWithMagicLink, initialState);

  if (state.status === "sent") {
    return (
      <p className="text-center text-brand-foreground/80">
        Check your email for a sign-in link.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      <label className="text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
        />
      </label>
      {state.status === "error" && <p className="text-sm text-red-400">{state.message}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-brand-accent px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send sign-in link"}
      </button>
    </form>
  );
}
