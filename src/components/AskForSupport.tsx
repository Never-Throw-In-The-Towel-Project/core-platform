"use client";

import { useActionState, useState } from "react";
import { submitSupportRequest, type SupportActionState } from "@/lib/actions/support";

const initialState: SupportActionState = { status: "idle" };

/**
 * "I want someone to check in with me" -- person-led only, never triggered
 * automatically by any journal answer or score. Must render on every
 * screen inside the platform (see the (app) and (admin) layouts that use
 * this), per the brief's non-negotiable flag.
 *
 * `variant` controls the trigger's look, not its behaviour: "floating" (the
 * original pill button, still used by the HR (admin) dashboard, which has
 * no bottom nav to sit above) or "inline" (a quiet text rule, meant to sit
 * directly above a bottom tab bar -- the design reference's own recommended
 * placement, "always in the same place, reads as part of the furniture, no
 * urgency implied", over a floating button which "breaks the flat grid").
 */
export function AskForSupport({
  helplineNumber,
  variant = "floating",
}: {
  helplineNumber?: string;
  variant?: "floating" | "inline";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(submitSupportRequest, initialState);
  const [stayAnonymous, setStayAnonymous] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          variant === "inline"
            ? "block w-full border-t border-current/10 px-6 py-3 text-left text-sm font-medium text-brand-accent"
            : "fixed bottom-4 right-4 z-50 rounded-full bg-brand-accent px-5 py-3 text-sm font-semibold text-brand-accent-foreground shadow-lg"
        }
      >
        I want someone to check in with me
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
          <div className="w-full max-w-md border-2 border-black/10 bg-background text-foreground">
            {state.status !== "success" && (
              <p className="bg-brand-background px-6 py-3 text-sm text-brand-foreground">
                If this is urgent right now, please call{" "}
                <span className="font-semibold">{helplineNumber ?? "the helpline"}</span>.
              </p>
            )}
            <div className="p-6">
            {state.status === "success" ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Thanks for reaching out.</h2>
                <p className="text-sm opacity-80">
                  Someone will be in touch. If this is urgent right now, please call{" "}
                  {helplineNumber ?? "the helpline"}.
                </p>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="border-2 border-black/20 px-4 py-2 text-sm font-medium"
                >
                  Close
                </button>
              </div>
            ) : (
              <form action={formAction} className="space-y-4">
                <h2 className="text-lg font-semibold">I want someone to check in with me</h2>

                <input type="hidden" name="stayAnonymous" value={String(stayAnonymous)} />

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={stayAnonymous}
                    onChange={(e) => setStayAnonymous(e.target.checked)}
                  />
                  Stay anonymous to the person who contacts me
                </label>

                {!stayAnonymous && (
                  <label className="block text-sm">
                    Your name
                    <input
                      name="displayName"
                      type="text"
                      className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2"
                    />
                  </label>
                )}

                <fieldset className="space-y-2 text-sm">
                  <legend className="mb-1">How urgent is this?</legend>
                  {[
                    { value: "check_in", label: "Just a check-in" },
                    { value: "talk_today", label: "I'd like to talk today" },
                    { value: "urgent", label: "This is urgent" },
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2">
                      <input type="radio" name="urgency" value={opt.value} required />
                      {opt.label}
                    </label>
                  ))}
                </fieldset>

                <label className="block text-sm">
                  Best way to reach you
                  <input
                    name="contactMethod"
                    type="text"
                    placeholder="Phone, email, whatever's easiest"
                    className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2"
                  />
                </label>

                {state.status === "error" && (
                  <p className="text-sm text-red-700">{state.message}</p>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-md px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-brand-accent-foreground disabled:opacity-50"
                  >
                    {isPending ? "Sending…" : "Send"}
                  </button>
                </div>
              </form>
            )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
