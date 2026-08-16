"use client";

import { useActionState, useEffect, useRef } from "react";
import { createEvent, updateEvent } from "@/lib/actions/events";
import { initialRoutineState } from "@/lib/actions/routineState";
import { isoToBrowserLocalInput } from "@/lib/events/format";
import type { EventRow } from "@/types/database";

const LABEL = "block text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted";
const FIELD = "mt-1 w-full border border-rule-border bg-transparent px-3 py-2 text-sm";
const OPTIONAL = <span className="font-semibold normal-case tracking-normal text-muted">(optional)</span>;

/**
 * Create or edit an event. When `event` is passed it's edit mode (updateEvent);
 * otherwise create mode (createEvent, with a publish-now checkbox). ntitt_admin
 * only; enforced again server-side and by RLS.
 *
 * Datetime handling: the visible `datetime-local` pickers are the admin's own
 * clock, kept uncontrolled; on change we write a UTC ISO string into the HIDDEN
 * field the action actually reads (via a ref, no React state), so the browser
 * resolves the local->UTC offset. The visible default is a browser-local render
 * of the stored instant, marked suppressHydrationWarning because the server
 * (UTC) and the client (the admin's timezone) format it differently -- the
 * client value is the correct one and wins after hydration.
 */
export function EventStudioForm({ event }: { event?: EventRow }) {
  const isEdit = Boolean(event);
  const [state, formAction, isPending] = useActionState(
    isEdit ? updateEvent : createEvent,
    initialRoutineState
  );
  const formRef = useRef<HTMLFormElement>(null);
  const startsIsoRef = useRef<HTMLInputElement>(null);
  const endsIsoRef = useRef<HTMLInputElement>(null);

  // On create success, clear the form for the next event. form.reset() also
  // restores the hidden ISO fields to their (empty) defaults -- no setState.
  useEffect(() => {
    if (state.status === "success" && !isEdit) formRef.current?.reset();
  }, [state, isEdit]);

  return (
    <form ref={formRef} action={formAction} className="space-y-5 border border-rule-border p-5">
      {isEdit && <input type="hidden" name="eventId" value={event!.id} />}
      <input type="hidden" name="startsAt" ref={startsIsoRef} defaultValue={event?.starts_at ?? ""} />
      <input type="hidden" name="endsAt" ref={endsIsoRef} defaultValue={event?.ends_at ?? ""} />

      <div>
        <label htmlFor="event-title" className={LABEL}>
          Title
        </label>
        <input
          id="event-title"
          name="title"
          required
          maxLength={200}
          defaultValue={event?.title ?? ""}
          className={FIELD}
          placeholder="Cold-plunge river dip"
        />
      </div>

      <div>
        <label htmlFor="event-summary" className={LABEL}>
          Summary {OPTIONAL}
        </label>
        <input
          id="event-summary"
          name="summary"
          maxLength={300}
          defaultValue={event?.summary ?? ""}
          className={FIELD}
          placeholder="One line shown on the events list."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="event-starts" className={LABEL}>
            Starts
          </label>
          <input
            id="event-starts"
            type="datetime-local"
            required
            suppressHydrationWarning
            defaultValue={event?.starts_at ? isoToBrowserLocalInput(event.starts_at) : ""}
            onChange={(e) => {
              if (startsIsoRef.current) {
                startsIsoRef.current.value = e.target.value ? new Date(e.target.value).toISOString() : "";
              }
            }}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="event-ends" className={LABEL}>
            Ends {OPTIONAL}
          </label>
          <input
            id="event-ends"
            type="datetime-local"
            suppressHydrationWarning
            defaultValue={event?.ends_at ? isoToBrowserLocalInput(event.ends_at) : ""}
            onChange={(e) => {
              if (endsIsoRef.current) {
                endsIsoRef.current.value = e.target.value ? new Date(e.target.value).toISOString() : "";
              }
            }}
            className={FIELD}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="event-location" className={LABEL}>
            Location {OPTIONAL}
          </label>
          <input
            id="event-location"
            name="locationName"
            maxLength={200}
            defaultValue={event?.location_name ?? ""}
            className={FIELD}
            placeholder="Alnwick Garden, the cascade"
          />
        </div>
        <div>
          <label htmlFor="event-capacity" className={LABEL}>
            Capacity {OPTIONAL}
          </label>
          <input
            id="event-capacity"
            name="capacity"
            type="number"
            min={1}
            max={100000}
            inputMode="numeric"
            defaultValue={event?.capacity ?? ""}
            className={FIELD}
            placeholder="Leave blank for unlimited"
          />
        </div>
      </div>

      <div>
        <label htmlFor="event-location-url" className={LABEL}>
          Location link {OPTIONAL}
        </label>
        <input
          id="event-location-url"
          name="locationUrl"
          type="url"
          maxLength={500}
          defaultValue={event?.location_url ?? ""}
          className={FIELD}
          placeholder="https://maps.app.goo.gl/…"
        />
      </div>

      <div>
        <label htmlFor="event-image-url" className={LABEL}>
          Image link {OPTIONAL}
        </label>
        <input
          id="event-image-url"
          name="imageUrl"
          type="url"
          maxLength={500}
          defaultValue={event?.image_url ?? ""}
          className={FIELD}
          placeholder="https://…/photo.jpg"
        />
      </div>

      <div>
        <label htmlFor="event-description" className={LABEL}>
          Description {OPTIONAL}
        </label>
        <textarea
          id="event-description"
          name="description"
          rows={4}
          maxLength={5000}
          defaultValue={event?.description ?? ""}
          className={`${FIELD} resize-y`}
          placeholder="What to expect, what to bring, where to meet…"
        />
      </div>

      {!isEdit && (
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="publish" value="true" className="h-4 w-4" />
          Publish now (leave unchecked to keep it a draft)
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-brand-accent px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
        >
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Create event"}
        </button>
        {state.status === "error" && <p className="text-sm text-brand-accent-deep">{state.message}</p>}
        {state.status === "success" && (
          <p className="text-sm font-semibold text-foreground" role="status">
            {state.message ?? "Saved."}
          </p>
        )}
      </div>
    </form>
  );
}
