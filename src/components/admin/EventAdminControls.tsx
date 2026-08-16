"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setEventPublished, setEventCancelled, deleteEvent } from "@/lib/actions/events";
import { initialRoutineState } from "@/lib/actions/routineState";

const BTN = "border px-4 py-2 text-xs font-extrabold uppercase tracking-wide transition-colors disabled:opacity-50";

/** Publish / cancel / delete controls for one event. ntitt_admin only. */
export function EventAdminControls({
  eventId,
  isPublished,
  isCancelled,
}: {
  eventId: string;
  isPublished: boolean;
  isCancelled: boolean;
}) {
  const router = useRouter();
  const [pubState, pubAction, pubPending] = useActionState(setEventPublished, initialRoutineState);
  const [canState, canAction, canPending] = useActionState(setEventCancelled, initialRoutineState);
  const [delState, delAction, delPending] = useActionState(deleteEvent, initialRoutineState);

  useEffect(() => {
    if (delState.status === "success") router.push("/admin/events");
  }, [delState, router]);

  const errored =
    pubState.status === "error"
      ? pubState.message
      : canState.status === "error"
        ? canState.message
        : delState.status === "error"
          ? delState.message
          : null;

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

      <form
        action={delAction}
        onSubmit={(e) => {
          if (!confirm("Delete this event and all of its bookings? This can’t be undone.")) {
            e.preventDefault();
          }
        }}
        className="ml-auto"
      >
        <input type="hidden" name="eventId" value={eventId} />
        <button
          type="submit"
          disabled={delPending}
          className={BTN + " border-transparent text-brand-accent-deep hover:underline"}
        >
          {delPending ? "Deleting…" : "Delete"}
        </button>
      </form>

      {errored && <p className="w-full text-sm text-brand-accent-deep">{errored}</p>}
    </div>
  );
}
