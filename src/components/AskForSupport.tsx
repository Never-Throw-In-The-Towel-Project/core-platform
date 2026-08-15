"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { submitSupportRequest, type SupportActionState } from "@/lib/actions/support";

const initialState: SupportActionState = { status: "idle" };

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
 *
 * Accessibility: this is the product's single most important safety feature,
 * so the dialog implements the full ARIA dialog pattern -- role="dialog" +
 * aria-modal, focus moved into the dialog on open and restored to the
 * trigger on close, a focus trap, Escape-to-close, backdrop-click dismiss,
 * background scroll lock, and an announced (role="status") success state --
 * rather than a bare div a keyboard or screen-reader user could tab straight
 * out of without knowing it opened.
 */
export function AskForSupport({
  helplineNumber,
  variant = "floating",
  label = "I want someone to check in with me",
}: {
  helplineNumber?: string;
  variant?: "floating" | "inline" | "header" | "block";
  label?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(submitSupportRequest, initialState);
  const [stayAnonymous, setStayAnonymous] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();

  // Focus management, Escape, focus trap, and scroll lock while open.
  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () =>
      dialogRef.current
        ? Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        : [];

    focusables()[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  // Move focus to the confirmation heading once the request succeeds -- the
  // Send button it was on no longer exists, so without this focus would drop
  // to <body>. role="status" on the panel also announces it to a reader.
  useEffect(() => {
    if (isOpen && state.status === "success") {
      successHeadingRef.current?.focus();
    }
  }, [isOpen, state.status]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        className={
          variant === "inline"
            ? // Mobile: full-width support link, 2px ink top rule, accent-deep
              // text (#ae1800 -> 6.5:1 on the light ground) per the handoff.
              "block w-full border-t-2 border-foreground px-6 py-3 text-left text-sm font-extrabold text-brand-accent-deep"
            : variant === "header"
              ? // Desktop: the support link that lives in the ink header, in
                // accent-light (#ff9783 -> ~7.9:1 on ink).
                "text-xs font-extrabold uppercase tracking-wide text-brand-accent-light hover:text-brand-accent-light-2"
              : variant === "block"
                ? // Card CTA: a full-width solid-accent button, e.g. the Today
                  // right-rail Support card sitting on the ink surface.
                  "block w-full bg-brand-accent px-4 py-3 text-center text-xs font-extrabold uppercase tracking-wide text-brand-accent-foreground hover:brightness-110"
                : "fixed bottom-4 right-4 z-50 rounded-full bg-brand-accent px-5 py-3 text-sm font-semibold text-brand-accent-foreground shadow-lg"
        }
      >
        {label}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            className="w-full max-w-md border-2 border-black/10 bg-background text-foreground"
          >
            {state.status !== "success" && (
              <p className="bg-brand-background px-6 py-3 text-sm text-brand-foreground">
                If this is urgent right now, please call{" "}
                <span className="font-semibold">{helplineNumber ?? "the helpline"}</span>.
              </p>
            )}
            <div className="p-6">
            {state.status === "success" ? (
              <div className="space-y-4" role="status">
                <h2
                  id={headingId}
                  ref={successHeadingRef}
                  tabIndex={-1}
                  className="text-lg font-semibold outline-none"
                >
                  Thanks for reaching out.
                </h2>
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
                <h2 id={headingId} className="text-lg font-semibold">
                  I want someone to check in with me
                </h2>

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
                      autoComplete="name"
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
                  <p role="alert" className="text-sm text-red-700">
                    {state.message}
                  </p>
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
