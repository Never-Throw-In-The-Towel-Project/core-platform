"use client";

import { useActionState, useState } from "react";
import { requestGuestBooking } from "@/lib/actions/events";
import { initialRoutineState } from "@/lib/actions/routineState";
import { TextField } from "@/components/ui/form";

const BTN =
  "border-2 border-foreground px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-foreground transition-colors hover:bg-foreground hover:text-background disabled:opacity-50";

type GuestErrors = { name?: string; email?: string };

function validateGuest(name: string, email: string): GuestErrors {
  const errs: GuestErrors = {};
  if (!name.trim()) errs.name = "Add your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "Enter a valid email address.";
  return errs;
}

/**
 * Book onto an event as a guest -- name + email, no account. Submits to
 * requestGuestBooking, which emails a double opt-in confirm link (the seat is
 * only claimed once they click it). Controlled + client-validated so a slip
 * highlights the field instead of clearing what they typed.
 */
export function GuestBookingForm({ eventId, slug, isFull }: { eventId: string; slug: string; isFull: boolean }) {
  const [state, action, pending] = useActionState(requestGuestBooking, initialRoutineState);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<GuestErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Clear on a successful request (adjust-state-during-render, not an effect).
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state.status === "success") {
      setName("");
      setEmail("");
      setErrors({});
      setSubmitAttempted(false);
    }
  }

  function revalidate(nextName: string, nextEmail: string) {
    if (submitAttempted) setErrors(validateGuest(nextName, nextEmail));
  }

  function handleSubmit() {
    setSubmitAttempted(true);
    const errs = validateGuest(name, email);
    setErrors(errs);
    if (errs.name) {
      document.getElementById("guest-name")?.focus();
      return;
    }
    if (errs.email) {
      document.getElementById("guest-email")?.focus();
      return;
    }
    const fd = new FormData();
    fd.set("eventId", eventId);
    fd.set("slug", slug);
    fd.set("name", name.trim());
    fd.set("email", email.trim());
    action(fd);
  }

  return (
    <div className="border border-rule-border p-5">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">Book as a guest</p>
      <p className="mt-1 text-sm text-muted">
        No account needed — we’ll email you to confirm{isFull ? " your waitlist place" : " your spot"}.
      </p>
      <form action={handleSubmit} noValidate className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            id="guest-name"
            label="Your name"
            value={name}
            error={errors.name}
            onChange={(e) => {
              setName(e.target.value);
              revalidate(e.target.value, email);
            }}
            maxLength={100}
            autoComplete="name"
          />
          <TextField
            id="guest-email"
            label="Your email"
            type="email"
            value={email}
            error={errors.email}
            onChange={(e) => {
              setEmail(e.target.value);
              revalidate(name, e.target.value);
            }}
            maxLength={200}
            autoComplete="email"
          />
        </div>
        <button type="submit" disabled={pending} className={BTN}>
          {pending ? "…" : isFull ? "Join the waitlist" : "Book as guest"}
        </button>
      </form>
      {state.status === "error" && (
        <p role="alert" className="mt-2 text-sm text-brand-accent-deep">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p role="status" className="mt-2 text-sm font-semibold text-foreground">
          {state.message}
        </p>
      )}
    </div>
  );
}
