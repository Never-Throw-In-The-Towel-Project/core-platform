"use client";

import { useActionState, useState } from "react";
import {
  signInWithMagicLink,
  signInWithPassword,
  type MagicLinkState,
  type PasswordLoginState,
} from "@/lib/actions/auth";

const initialMagicLinkState: MagicLinkState = { status: "idle" };
const initialPasswordState: PasswordLoginState = { status: "idle" };

export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<"magic-link" | "password">("magic-link");

  return mode === "magic-link" ? (
    <MagicLinkForm next={next} onUsePassword={() => setMode("password")} />
  ) : (
    <PasswordForm next={next} onUseMagicLink={() => setMode("magic-link")} />
  );
}

function MagicLinkForm({ next, onUsePassword }: { next?: string; onUsePassword: () => void }) {
  const [state, formAction, isPending] = useActionState(signInWithMagicLink, initialMagicLinkState);

  if (state.status === "sent") {
    return (
      <p className="text-center text-foreground/80">
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
          className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2.5"
        />
      </label>
      {state.status === "error" && <p className="text-sm text-brand-accent-deep">{state.message}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-accent px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send sign-in link"}
      </button>
      <button type="button" onClick={onUsePassword} className="text-sm text-muted underline hover:text-foreground">
        Sign in with a password instead
      </button>
    </form>
  );
}

function PasswordForm({ next, onUseMagicLink }: { next?: string; onUseMagicLink: () => void }) {
  const [state, formAction, isPending] = useActionState(signInWithPassword, initialPasswordState);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      {next && <input type="hidden" name="next" value={next} />}
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
          className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2.5"
        />
      </label>
      {state.status === "error" && <p className="text-sm text-brand-accent-deep">{state.message}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-accent px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
      <button type="button" onClick={onUseMagicLink} className="text-sm text-muted underline hover:text-foreground">
        Use a sign-in link instead
      </button>
    </form>
  );
}
