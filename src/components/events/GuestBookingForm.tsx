"use client";

import { useActionState, useEffect, useRef } from "react";
import { requestGuestBooking } from "@/lib/actions/events";
import { initialRoutineState } from "@/lib/actions/routineState";

const FIELD = "w-full border border-rule-border bg-transparent px-3 py-2 text-sm";
const BTN =
  "border-2 border-foreground px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-foreground transition-colors hover:bg-foreground hover:text-background disabled:opacity-50";

/**
 * Book onto an event as a guest -- name + email, no account. Submits to
 * requestGuestBooking, which emails a double opt-in confirm link (the seat is
 * only claimed once they click it). Shown to logged-out visitors alongside the
 * "sign in to book" option.
 */
export function GuestBookingForm({ eventId, slug, isFull }: { eventId: string; slug: string; isFull: boolean }) {
  const [state, action, pending] = useActionState(requestGuestBooking, initialRoutineState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <div className="border border-rule-border p-5">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">Book as a guest</p>
      <p className="mt-1 text-sm text-muted">
        No account needed — we’ll email you to confirm{isFull ? " your waitlist place" : " your spot"}.
      </p>
      <form ref={formRef} action={action} className="mt-4 space-y-3">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="slug" value={slug} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="name" required maxLength={100} placeholder="Your name" autoComplete="name" className={FIELD} />
          <input
            name="email"
            type="email"
            required
            maxLength={200}
            placeholder="Your email"
            autoComplete="email"
            className={FIELD}
          />
        </div>
        <button type="submit" disabled={pending} className={BTN}>
          {pending ? "…" : isFull ? "Join the waitlist" : "Book as guest"}
        </button>
      </form>
      {state.status === "error" && <p className="mt-2 text-sm text-brand-accent-deep">{state.message}</p>}
      {state.status === "success" && (
        <p className="mt-2 text-sm font-semibold text-foreground" role="status">
          {state.message}
        </p>
      )}
    </div>
  );
}
