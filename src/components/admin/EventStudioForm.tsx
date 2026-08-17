"use client";

import { useActionState, useMemo, useState } from "react";
import { createEvent, updateEvent } from "@/lib/actions/events";
import { initialEventFormState, type EventFormState } from "@/lib/actions/eventFormState";
import {
  addMinutesToLocalInput,
  formatEventWhen,
  isoToBrowserLocalInput,
  localInputToIso,
  nextHourLocalInput,
} from "@/lib/events/format";
import {
  EVENT_LIMITS,
  firstErrorField,
  validateEventFields,
  type EventFieldErrors,
  type EventFieldValues,
} from "@/lib/events/validation";
import { FormSection, Switch, TextAreaField, TextField } from "@/components/ui/form";
import type { EventRow } from "@/types/database";

type EventFormAction = (prev: EventFormState, formData: FormData) => Promise<EventFormState>;

/** DOM ids per field, so "focus the first error" can jump to it. */
const FIELD_IDS: Record<keyof EventFieldValues | "startsAt" | "endsAt", string> = {
  title: "event-title",
  summary: "event-summary",
  description: "event-description",
  startsLocal: "event-starts",
  endsLocal: "event-ends",
  startsAt: "event-starts",
  endsAt: "event-ends",
  locationName: "event-location",
  locationUrl: "event-location-url",
  imageUrl: "event-image-url",
  capacity: "event-capacity",
};

function blankValues(): EventFieldValues {
  return {
    title: "",
    summary: "",
    description: "",
    startsLocal: "",
    endsLocal: "",
    locationName: "",
    locationUrl: "",
    imageUrl: "",
    capacity: "",
  };
}

function valuesFromEvent(event: EventRow): EventFieldValues {
  // Text fields are SSR-safe (plain strings from the server). The datetime
  // fields are filled client-side in an effect (browser-local), NOT here, to
  // avoid a UTC-vs-local hydration mismatch.
  return {
    title: event.title ?? "",
    summary: event.summary ?? "",
    description: event.description ?? "",
    startsLocal: "",
    endsLocal: "",
    locationName: event.location_name ?? "",
    locationUrl: event.location_url ?? "",
    imageUrl: event.image_url ?? "",
    capacity: event.capacity != null ? String(event.capacity) : "",
  };
}

/**
 * Create or edit an event. When `event` is passed it's edit mode (updateEvent);
 * otherwise create mode (createEvent, with a publish-now toggle). ntitt_admin or
 * hr_admin (via `createAction`); enforced again server-side and by RLS.
 *
 * The form is fully CONTROLLED: every value lives in React state, so a
 * validation error can NEVER wipe what was typed (the old uncontrolled form was
 * reset by React after each form action, blanking everything on any error).
 * Validation runs on the client first (mirroring the server zod rules) and
 * highlights the exact field(s) at fault; the server stays the real authority
 * and returns the same per-field shape for defence in depth.
 *
 * Datetimes: the visible `datetime-local` pickers are the admin's own clock; on
 * submit each is converted to a UTC ISO instant so the browser resolves the
 * local->UTC offset. Picking a start auto-fills the end to +1h (until the end is
 * edited by hand), and a live "when" preview shows exactly what members will see.
 */
export function EventStudioForm({
  event,
  createAction,
}: {
  event?: EventRow;
  /** Overrides the create action (e.g. HR's company-scoped createCompanyEvent).
   *  Ignored in edit mode, which always uses the shared updateEvent. */
  createAction?: EventFormAction;
}) {
  const isEdit = Boolean(event);
  const [state, formAction, isPending] = useActionState(
    isEdit ? updateEvent : (createAction ?? createEvent),
    initialEventFormState
  );

  // Datetimes are seeded in the (client-only) lazy initializer, NOT an effect:
  // the browser resolves the local wall-clock, so SSR renders them empty (the
  // `suppressHydrationWarning` on those inputs covers the empty->local swap on
  // hydration) and edit-mode text fields hydrate from `event` with no mismatch.
  const [values, setValues] = useState<EventFieldValues>(() => {
    const base = event ? valuesFromEvent(event) : blankValues();
    if (typeof window === "undefined") return base;
    return {
      ...base,
      startsLocal: event
        ? event.starts_at
          ? isoToBrowserLocalInput(event.starts_at)
          : ""
        : nextHourLocalInput(),
      endsLocal: event?.ends_at ? isoToBrowserLocalInput(event.ends_at) : "",
    };
  });
  const [errors, setErrors] = useState<EventFieldErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [publish, setPublish] = useState(false);
  // Whether the admin has hand-edited the end time; once true we stop
  // auto-filling it from the start so we never fight a deliberate choice.
  const [endTouched, setEndTouched] = useState<boolean>(() => Boolean(event?.ends_at));

  // Clear the form on a fresh CREATE success. Done by adjusting state DURING
  // render (React's documented pattern, matching ContentStudioForm) rather than
  // in an effect, which would trip the cascading-render lint rule. Edit mode
  // keeps its values. Controlled inputs follow state, so nothing is ever wiped
  // by React's post-action form reset.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (!isEdit && state.status === "success") {
      setValues(blankValues());
      setErrors({});
      setSubmitAttempted(false);
      setPublish(false);
      setEndTouched(false);
    } else if (state.status === "error" && state.fieldErrors) {
      // Defence in depth: if the server ever rejects a field the client passed,
      // highlight it too (so the "fix the highlighted fields" line is truthful).
      // Editing re-validates on the client and clears it.
      setErrors(state.fieldErrors);
      setSubmitAttempted(true);
    }
  }

  // Applying a value change also re-validates once the admin has submitted once,
  // so per-field errors clear live as each is fixed (and we stay quiet before
  // the first submit -- no nagging while typing). setState in an event handler
  // is fine; the lint rule only forbids it inside effects.
  function applyValues(next: EventFieldValues) {
    setValues(next);
    if (submitAttempted) setErrors(validateEventFields(next));
  }

  function patch(next: Partial<EventFieldValues>) {
    applyValues({ ...values, ...next });
  }

  function onStartChange(local: string) {
    const next = { ...values, startsLocal: local };
    // Auto-fill the end to start + 1h until the admin sets it themselves.
    if (local && !endTouched) next.endsLocal = addMinutesToLocalInput(local, 60);
    applyValues(next);
  }

  function onEndChange(local: string) {
    setEndTouched(true);
    applyValues({ ...values, endsLocal: local });
  }

  function handleSubmit() {
    setSubmitAttempted(true);
    const found = validateEventFields(values);
    setErrors(found);
    const firstKey = firstErrorField(found);
    if (firstKey) {
      document.getElementById(FIELD_IDS[firstKey])?.focus();
      return; // client-invalid: never reach the server, never lose the input
    }

    const fd = new FormData();
    fd.set("title", values.title.trim());
    fd.set("summary", values.summary.trim());
    fd.set("description", values.description.trim());
    fd.set("locationName", values.locationName.trim());
    fd.set("locationUrl", values.locationUrl.trim());
    fd.set("imageUrl", values.imageUrl.trim());
    fd.set("capacity", values.capacity.trim());
    fd.set("startsAt", localInputToIso(values.startsLocal) ?? "");
    fd.set("endsAt", localInputToIso(values.endsLocal) ?? "");
    if (isEdit && event) fd.set("eventId", event.id);
    if (!isEdit && publish) fd.set("publish", "true");
    formAction(fd);
  }

  const serverMessage = state.status === "error" ? state.message : null;
  const isSuccess = state.status === "success";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <form action={handleSubmit} noValidate className="min-w-0 border border-rule-border">
        <div className="space-y-8 p-5 sm:p-6">
          <FormSection title="Basics">
            <TextField
              id={FIELD_IDS.title}
              label="Title"
              value={values.title}
              onChange={(e) => patch({ title: e.target.value })}
              error={errors.title}
              maxLength={EVENT_LIMITS.title}
              placeholder="Cold-plunge river dip"
              autoComplete="off"
            />
            <TextField
              id={FIELD_IDS.summary}
              label="Summary"
              optional
              value={values.summary}
              onChange={(e) => patch({ summary: e.target.value })}
              error={errors.summary}
              maxLength={EVENT_LIMITS.summary}
              placeholder="One line shown on the events list."
              hint="Shown under the title on the events list."
            />
          </FormSection>

          <FormSection title="When">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id={FIELD_IDS.startsLocal}
                label="Starts"
                type="datetime-local"
                value={values.startsLocal}
                onChange={(e) => onStartChange(e.target.value)}
                error={errors.startsAt}
                suppressHydrationWarning
              />
              <TextField
                id={FIELD_IDS.endsLocal}
                label="Ends"
                optional
                type="datetime-local"
                value={values.endsLocal}
                onChange={(e) => onEndChange(e.target.value)}
                error={errors.endsAt}
                hint="Defaults to an hour after the start."
                suppressHydrationWarning
              />
            </div>
          </FormSection>

          <FormSection title="Where">
            <TextField
              id={FIELD_IDS.locationName}
              label="Location"
              optional
              value={values.locationName}
              onChange={(e) => patch({ locationName: e.target.value })}
              error={errors.locationName}
              maxLength={EVENT_LIMITS.locationName}
              placeholder="Alnwick Garden, the cascade"
            />
            <TextField
              id={FIELD_IDS.locationUrl}
              label="Location link"
              optional
              type="url"
              value={values.locationUrl}
              onChange={(e) => patch({ locationUrl: e.target.value })}
              error={errors.locationUrl}
              maxLength={EVENT_LIMITS.locationUrl}
              placeholder="https://maps.app.goo.gl/…"
              hint="A map link members can tap for directions."
            />
          </FormSection>

          <FormSection title="Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id={FIELD_IDS.capacity}
                label="Capacity"
                optional
                type="number"
                inputMode="numeric"
                min={1}
                max={EVENT_LIMITS.capacityMax}
                value={values.capacity}
                onChange={(e) => patch({ capacity: e.target.value })}
                error={errors.capacity}
                placeholder="Unlimited"
                hint="Leave blank for unlimited. Extra bookings join a waitlist."
              />
              <TextField
                id={FIELD_IDS.imageUrl}
                label="Image link"
                optional
                type="url"
                value={values.imageUrl}
                onChange={(e) => patch({ imageUrl: e.target.value })}
                error={errors.imageUrl}
                maxLength={EVENT_LIMITS.imageUrl}
                placeholder="https://…/photo.jpg"
              />
            </div>
            <TextAreaField
              id={FIELD_IDS.description}
              label="Description"
              optional
              rows={5}
              value={values.description}
              onChange={(e) => patch({ description: e.target.value })}
              error={errors.description}
              maxLength={EVENT_LIMITS.description}
              placeholder="What to expect, what to bring, where to meet…"
            />
          </FormSection>

          {!isEdit && (
            <FormSection title="Visibility">
              <Switch
                id="event-publish"
                checked={publish}
                onChange={setPublish}
                label={publish ? "Publish now" : "Save as draft"}
                description={
                  publish
                    ? "Live immediately — members and (for global events) the public can see and book it."
                    : "Hidden from everyone until you publish it."
                }
              />
            </FormSection>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-rule-hairline bg-background/60 px-5 py-4 sm:px-6">
          <button
            type="submit"
            disabled={isPending}
            className="bg-brand-accent px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Saving…" : isEdit ? "Save changes" : publish ? "Publish event" : "Create draft"}
          </button>
          {serverMessage && (
            <p role="alert" className="text-sm font-semibold text-brand-accent-deep">
              {serverMessage}
            </p>
          )}
          {isSuccess && (
            <p role="status" className="text-sm font-semibold text-foreground">
              {state.message ?? "Saved."}
            </p>
          )}
        </div>
      </form>

      <EventPreviewCard values={values} isEdit={isEdit} />
    </div>
  );
}

/** Live "this is how it'll look" card, mirroring the member event card. */
function EventPreviewCard({ values, isEdit }: { values: EventFieldValues; isEdit: boolean }) {
  const startIso = localInputToIso(values.startsLocal);
  const endIso = localInputToIso(values.endsLocal);
  const when = useMemo(() => (startIso ? formatEventWhen(startIso, endIso) : null), [startIso, endIso]);
  const cap = values.capacity.trim();
  const imageOk = useMemo(() => {
    const u = values.imageUrl.trim();
    if (!u) return false;
    try {
      new URL(u);
      return true;
    } catch {
      return false;
    }
  }, [values.imageUrl]);

  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted">Live preview</p>
      <div className="mt-2 border border-rule-border">
        {imageOk ? (
          <div className="aspect-[16/9] w-full overflow-hidden border-b border-rule-border">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin-pasted URL preview */}
            <img src={values.imageUrl.trim()} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex aspect-[16/9] w-full items-center justify-center border-b border-rule-hairline bg-background text-[11px] font-semibold uppercase tracking-wide text-muted">
            No image
          </div>
        )}
        <div className="p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep">
            {when ?? "Add a start time"}
          </p>
          <h3 className="mt-1.5 font-extrabold leading-tight tracking-tight">
            {values.title.trim() || "Untitled event"}
          </h3>
          {values.locationName.trim() && (
            <p className="mt-1 text-sm text-muted">{values.locationName.trim()}</p>
          )}
          {values.summary.trim() && (
            <p className="mt-2 line-clamp-3 text-sm text-muted">{values.summary.trim()}</p>
          )}
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
            {cap ? `Capacity ${cap}` : "Unlimited spots"}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        {isEdit
          ? "Reflects your unsaved edits. Save to apply."
          : "Updates as you type. Members see this card on the events list."}
      </p>
    </aside>
  );
}
