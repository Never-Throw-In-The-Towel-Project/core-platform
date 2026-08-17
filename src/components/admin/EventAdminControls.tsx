"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setEventPublished, setEventCancelled, deleteEvent } from "@/lib/actions/events";
import { initialRoutineState } from "@/lib/actions/routineState";

const BTN = "border px-4 py-2 text-xs font-extrabold uppercase tracking-wide transition-colors disabled:opacity-50";

/** Publish / cancel / delete controls for one event. Used by both the ntitt_admin
 *  Studio and the HR Workspace; `backHref` is where a successful delete returns.
 *  Delete goes through an in-design confirm modal (not the native confirm()). */
export function EventAdminControls({
  eventId,
  isPublished,
  isCancelled,
  bookingCount = 0,
  backHref = "/admin/events",
}: {
  eventId: string;
  isPublished: boolean;
  isCancelled: boolean;
  bookingCount?: number;
  backHref?: string;
}) {
  const router = useRouter();
  const [pubState, pubAction, pubPending] = useActionState(setEventPublished, initialRoutineState);
  const [canState, canAction, canPending] = useActionState(setEventCancelled, initialRoutineState);
  const [delState, delAction, delPending] = useActionState(deleteEvent, initialRoutineState);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (delState.status === "success") router.push(backHref);
  }, [delState, router, backHref]);

  const errored =
    pubState.status === "error"
      ? pubState.message
      : canState.status === "error"
        ? canState.message
        : delState.status === "error"
          ? delState.message
          : null;

  function confirmDelete() {
    const fd = new FormData();
    fd.set("eventId", eventId);
    delAction(fd);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border border-rule-border p-4">
      <form action={pubAction}>
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="publish" value={isPublished ? "false" : "true"} />
        <button
          type="submit"
          disabled={pubPending}
          className={
            BTN +
            (isPublished
              ? " border-rule-border text-foreground hover:bg-foreground/[0.04]"
              : " border-brand-accent bg-brand-accent text-brand-accent-foreground hover:opacity-90")
          }
        >
          {pubPending ? "…" : isPublished ? "Unpublish" : "Publish"}
        </button>
      </form>

      <form action={canAction}>
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="cancel" value={isCancelled ? "false" : "true"} />
        <button
          type="submit"
          disabled={canPending}
          className={BTN + " border-rule-border text-foreground hover:bg-foreground/[0.04]"}
        >
          {canPending ? "…" : isCancelled ? "Reinstate event" : "Cancel event"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={delPending}
        className={BTN + " ml-auto border-transparent text-brand-accent-deep hover:underline"}
      >
        {delPending ? "Deleting…" : "Delete"}
      </button>

      {errored && <p className="w-full text-sm text-brand-accent-deep">{errored}</p>}

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-event-title"
          onKeyDown={(e) => {
            if (e.key === "Escape") setConfirmOpen(false);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmOpen(false);
          }}
        >
          <div className="w-full max-w-sm border-2 border-foreground bg-background p-6">
            <h3 id="delete-event-title" className="text-lg font-extrabold tracking-tight">
              Delete this event?
            </h3>
            <p className="mt-2 text-sm text-muted">
              This permanently removes the event
              {bookingCount > 0
                ? ` and all ${bookingCount} booking${bookingCount === 1 ? "" : "s"}`
                : ""}
              . This can’t be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmOpen(false)}
                className="border border-rule-border px-4 py-2 text-xs font-extrabold uppercase tracking-wide hover:bg-foreground/[0.04]"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={delPending}
                className="bg-brand-accent px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-brand-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {delPending ? "Deleting…" : "Delete event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
