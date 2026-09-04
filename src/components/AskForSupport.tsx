"use client";

import { useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
import { submitSupportRequest, type SupportActionState } from "@/lib/actions/support";
import { SupportResourceList } from "@/components/support/SupportResourceList";
import { URGENT_RESOURCES, ONGOING_RESOURCES } from "@/lib/support/resources";

const initialState: SupportActionState = { status: "idle" };

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Which panel of the hub is showing. `responder` is the original, unchanged
 *  "have someone check in with me" flow (still routes to the member's company
 *  support contact via submitSupportRequest); success is driven by the action
 *  state, not this. */
type HubView = "choose" | "urgent" | "ongoing" | "responder";

/**
 * "Check in with me" -- a person-led support hub, never triggered automatically
 * by any journal answer or score. Must render on every screen inside the
 * platform (see the (app) and (admin) layouts that use this), per the brief's
 * non-negotiable flag.
 *
 * It opens a chooser split by urgency:
 *   - "I need help right now" -> external crisis lines (999 / NHS 111 / Samaritans
 *     / Shout), one-tap call/text, no form (URGENT_RESOURCES).
 *   - "I need support, but not urgently" -> NTITT's own events + community and
 *     lower-intensity men's charities (ONGOING_RESOURCES), plus the original
 *     "have someone from your workplace check in with me" request, whose flow is
 *     UNCHANGED (submitSupportRequest -> company support contact + SMS/email).
 * The resource list is signposting only; it never sends anything.
 *
 * `variant` controls the trigger's look, not its behaviour: "floating" (the
 * original pill button, still used by the HR (admin) dashboard, which has no
 * bottom nav to sit above), "inline" (a quiet text rule above a bottom tab bar),
 * "header" (the ink-bar CTA) or "block" (a full-width card CTA).
 *
 * Accessibility: this is the product's single most important safety feature, so
 * the dialog implements the full ARIA dialog pattern -- role="dialog" +
 * aria-modal, focus moved to the active panel's heading on open and on each
 * panel change and restored to the trigger on close, a focus trap,
 * Escape-to-close, backdrop-click dismiss, background scroll lock, and an
 * announced (role="status") success state.
 */
export function AskForSupport({
  helplineNumber,
  variant = "floating",
  label = "I want someone to check in with me",
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  helplineNumber?: string;
  variant?: "floating" | "inline" | "header" | "block";
  label?: string;
  /** Controlled open state — pass with onOpenChange to drive the dialog from
   *  elsewhere (e.g. a menu item), alongside hideTrigger to suppress the
   *  built-in button. Uncontrolled (internal state) when omitted, so every
   *  existing call is unchanged. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;
  const setIsOpen = useCallback(
    (value: boolean) => {
      if (!isControlled) setUncontrolledOpen(value);
      onOpenChange?.(value);
    },
    [isControlled, onOpenChange]
  );
  const [state, formAction, isPending] = useActionState(submitSupportRequest, initialState);
  const [view, setView] = useState<HubView>("choose");
  const [stayAnonymous, setStayAnonymous] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();

  // Fresh chooser each time the hub opens. Done as a render-phase adjustment on
  // the open transition (React's sanctioned "storing info from previous renders"
  // pattern) rather than in an effect, so the panel is right on first paint and
  // we don't setState inside an effect.
  const [wasOpen, setWasOpen] = useState(false);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setView("choose");
  }

  // Focus management, Escape, focus trap, and scroll lock while open.
  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () =>
      dialogRef.current
        ? Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        : [];

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
  }, [isOpen, setIsOpen]);

  // Move focus to the active panel's heading on open and on every panel change,
  // so a keyboard/screen-reader user lands on (and hears) the new panel rather
  // than having focus drop to <body>. The success panel has its own effect
  // below because its heading only exists once the request succeeds.
  useEffect(() => {
    if (isOpen && state.status !== "success") headingRef.current?.focus();
  }, [isOpen, view, state.status]);

  useEffect(() => {
    if (isOpen && state.status === "success") successHeadingRef.current?.focus();
  }, [isOpen, state.status]);

  return (
    <>
      {!hideTrigger && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-haspopup="dialog"
          className={
            variant === "inline"
              ? "block w-full border-t-2 border-foreground px-6 py-3 text-left text-sm font-extrabold text-brand-accent-deep"
              : variant === "header"
                ? "bg-brand-accent px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-brand-accent-foreground hover:brightness-110"
                : variant === "block"
                  ? "block w-full bg-brand-accent px-4 py-3 text-center text-xs font-extrabold uppercase tracking-wide text-brand-accent-foreground hover:brightness-110"
                  : "fixed bottom-4 right-4 z-50 rounded-full bg-brand-accent px-5 py-3 text-sm font-semibold text-brand-accent-foreground shadow-lg"
          }
        >
          {label}
        </button>
      )}

      {isOpen && (
        <div
          // data-surface="paper": this dialog is a viewport-level modal, so it
          // owns its surface and always renders on the light palette -- even when
          // launched from an ink surface (whose ground-token overrides it would
          // otherwise inherit through the DOM tree). Keeps the safety-critical
          // helpline band's ink-on-paper emphasis intact wherever it's opened.
          data-surface="paper"
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
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto border-2 border-foreground bg-background text-foreground"
          >
            {state.status !== "success" && (
              <p className="bg-brand-background px-6 py-3 text-sm text-brand-foreground">
                If this is urgent right now, please call{" "}
                <span className="font-semibold">{helplineNumber ?? "the helpline"}</span>.
              </p>
            )}
            <div className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
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
                  <p className="text-sm text-muted">
                    Someone will be in touch. If this is urgent right now, please call{" "}
                    {helplineNumber ?? "the helpline"}.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="border border-rule-border px-4 py-2 text-sm font-medium"
                  >
                    Close
                  </button>
                </div>
              ) : view === "choose" ? (
                <div className="space-y-4">
                  <h2 id={headingId} ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
                    What kind of support do you need?
                  </h2>
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setView("urgent")}
                      className="block w-full border-2 border-brand-accent p-4 text-left transition-colors hover:bg-brand-accent/5"
                    >
                      <p className="font-extrabold tracking-tight">I need help right now</p>
                      <p className="mt-0.5 text-sm text-muted">Talk to someone straight away — crisis lines, 24/7.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("ongoing")}
                      className="block w-full border border-rule-border p-4 text-left transition-colors hover:border-foreground"
                    >
                      <p className="font-extrabold tracking-tight">I need support, but it&apos;s not urgent</p>
                      <p className="mt-0.5 text-sm text-muted">Events, groups and people to talk to.</p>
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm">
                      Close
                    </button>
                  </div>
                </div>
              ) : view === "urgent" ? (
                <div className="space-y-4">
                  <BackButton onClick={() => setView("choose")} />
                  <h2 id={headingId} ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
                    Help right now
                  </h2>
                  <p className="text-sm text-muted">
                    You don&apos;t have to face this alone. Reach one of these — they&apos;re free and there for
                    exactly this.
                  </p>
                  <SupportResourceList resources={URGENT_RESOURCES} />
                </div>
              ) : view === "ongoing" ? (
                <div className="space-y-4">
                  <BackButton onClick={() => setView("choose")} />
                  <h2 id={headingId} ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
                    Support when you need it
                  </h2>
                  <SupportResourceList resources={ONGOING_RESOURCES} onNavigate={() => setIsOpen(false)} />
                  <div className="border-t border-rule-hairline pt-4">
                    <p className="text-sm text-muted">
                      Or, if you&apos;d rather a person from your workplace checked in with you:
                    </p>
                    <button
                      type="button"
                      onClick={() => setView("responder")}
                      className="mt-2 inline-flex min-h-[44px] items-center border border-rule-border px-4 py-2 text-sm font-semibold hover:border-foreground"
                    >
                      Ask for a check-in
                    </button>
                  </div>
                </div>
              ) : (
                <form action={formAction} className="space-y-4">
                  <BackButton onClick={() => setView("ongoing")} />
                  <h2 id={headingId} ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
                    I want someone to check in with me
                  </h2>

                  <input type="hidden" name="stayAnonymous" value={String(stayAnonymous)} />

                  <label className="flex items-center gap-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={stayAnonymous}
                      onChange={(e) => setStayAnonymous(e.target.checked)}
                      className="h-5 w-5 accent-brand-accent"
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
                        className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2.5"
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
                      <label key={opt.value} className="flex items-center gap-2 py-1">
                        <input type="radio" name="urgency" value={opt.value} required className="h-5 w-5 accent-brand-accent" />
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
                      className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2.5"
                    />
                  </label>

                  {state.status === "error" && (
                    <p role="alert" className="text-sm text-brand-accent-deep">
                      {state.message}
                    </p>
                  )}

                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setView("ongoing")} className="px-4 py-2 text-sm">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="bg-brand-accent px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
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

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted hover:text-foreground"
    >
      ← Back
    </button>
  );
}
