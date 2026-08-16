"use client";

import { useActionState } from "react";
import { bookEvent, cancelBooking } from "@/lib/actions/events";
import { initialRoutineState } from "@/lib/actions/routineState";
import type { EventBookingStatus } from "@/types/database";

const PRIMARY =
  "bg-brand-accent px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50";
const OUTLINE =
  "border-2 border-foreground px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-foreground transition-colors hover:bg-foreground hover:text-background disabled:opacity-50";

/**
 * The member book / cancel control. Booking always goes through the server
 * action -> book_event() function, so capacity + waitlist are enforced server
 * side; this component only reflects the caller's current status and reports the
 * outcome message. Hidden entirely when the event isn't bookable (cancelled or
 * already passed) -- the page renders a plain status line instead.
 */
export function EventBookButton({
  eventId,
  slug,
  myStatus,
  isFull,
}: {
  eventId: string;
  slug: string;
  myStatus: EventBookingStatus | null;
  isFull: boolean;
}) {
  const [bookState, bookAction, bookPending] = useActionState(bookEvent, initialRoutineState);
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelBooking, initialRoutineState);

  const booked = myStatus === "confirmed" || myStatus === "waitlisted";
  const message =
    bookState.status !== "idle"
      ? bookState.status === "error"
        ? bookState.message
        : bookState.message
      : cancelState.status !== "idle"
        ? cancelState.status === "error"
          ? cancelState.message
          : cancelState.message
        : null;
  const messageIsError = bookState.status === "error" || cancelState.status === "error";

  return (
    <div className="space-y-3">
      {booked ? (
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={
              "inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide " +
              (myStatus === "confirmed"
                ? "border-foreground text-foreground"
                : "border-rule-border text-muted")
            }
          >
            {myStatus === "confirmed" ? "You’re booked in" : "On the waitlist"}
          </span>
          <form action={cancelAction}>
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="slug" value={slug} />
            <button type="submit" disabled={cancelPending} className={OUTLINE}>
              {cancelPending ? "…" : myStatus === "confirmed" ? "Cancel booking" : "Leave waitlist"}
            </button>
          </form>
        </div>
      ) : (
        <form action={bookAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="slug" value={slug} />
          <button type="submit" disabled={bookPending} className={PRIMARY}>
            {bookPending ? "…" : isFull ? "Join the waitlist" : "Book your spot"}
          </button>
        </form>
      )}
      {message && (
        <p
          className={"text-sm " + (messageIsError ? "text-brand-accent-deep" : "font-semibold text-foreground")}
          role="status"
        >
          {message}
        </p>
      )}
    </div>
  );
}
