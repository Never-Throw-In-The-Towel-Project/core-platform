"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  createEvent,
  updateEvent,
  createEventImageUpload,
  discardEventImageUpload,
} from "@/lib/actions/events";
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
  validateEventImageInput,
  type EventFieldErrors,
  type EventFieldKey,
  type EventFieldValues,
} from "@/lib/events/validation";
import { downscaleImageToJpeg } from "@/lib/images/downscale";
import { getBrowserSupabase } from "@/lib/supabase/browserUpload";
import { FormSection, Switch, TextAreaField, TextField } from "@/components/ui/form";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import type { EventRow } from "@/types/database";

const EVENT_IMAGE_BUCKET = "event-images";
/** The event-images bucket's own size limit; a GIF (kept as-is to preserve
 *  animation, unlike a downscaled JPEG) must fit under it. */
const EVENT_IMAGE_BUCKET_MAX_BYTES = 5 * 1024 * 1024;

type EventFormAction = (prev: EventFormState, formData: FormData) => Promise<EventFormState>;

/** DOM ids keyed by the (server-shaped) error keys, so "focus the first error"
 *  can jump straight to the offending control. */
const FIELD_IDS: Record<EventFieldKey, string> = {
  title: "event-title",
  summary: "event-summary",
  description: "event-description",
  startsAt: "event-starts",
  endsAt: "event-ends",
  locationName: "event-location",
  locationUrl: "event-location-url",
  imageUrl: "event-image",
  capacity: "event-capacity",
};

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function blankValues(): EventFieldValues {
  return {
    title: "",
    summary: "",
    description: "",
    startsLocal: "",
    endsLocal: "",
    locationName: "",
    locationUrl: "",
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

  // Image state. `imageFile` is the picked File that drives the local preview;
  // the (downscaled) image is uploaded DIRECT to Storage the moment it's chosen,
  // so `imagePath` is the resulting object path submitted to the action and
  // `imageUploading` gates submit while the prepare+PUT is in flight. Isolating
  // the upload here means a failed image never blocks the event save, and a big
  // phone photo is shrunk before it moves anywhere. Mirrors the notice-video flow.
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);
  const existingImageUrl = event?.image_url ?? null;
  const imageObjectUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile]);
  useEffect(() => {
    return () => {
      if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    };
  }, [imageObjectUrl]);
  const imagePreviewUrl = imageObjectUrl ?? (removeImage ? null : existingImageUrl);
  const imageFileLabel = imageFile
    ? `${imageFile.name} · ${prettyBytes(imageFile.size)}`
    : imagePreviewUrl
      ? "Current image"
      : null;

  function setImageError(msg: string | null) {
    setErrors((prev) => {
      if (msg) return { ...prev, imageUrl: msg };
      if (!prev.imageUrl) return prev;
      const next = { ...prev };
      delete next.imageUrl;
      return next;
    });
  }

  // Validate the pick, downscale it in the browser (a straight-from-camera photo
  // becomes a small web JPEG), mint a signed URL (event-editor only), then PUT
  // straight to the event-images bucket. setState after each await is fine in an
  // event handler (the lint rule only forbids it inside effects).
  async function onImageSelect(file: File) {
    const bad = validateEventImageInput(file);
    if (bad) {
      setImageError(bad);
      return; // reject the bad pick; keep whatever was there
    }
    // Replacing an earlier pick? Bin the object it already uploaded so it doesn't
    // orphan -- only ever the fresh-upload path; updateEvent cleans the saved one.
    const superseded = imagePath;
    if (superseded) void discardEventImageUpload({ path: superseded }).catch(() => {});
    setImageFile(file); // show the local preview immediately
    setRemoveImage(false);
    setImagePath(null);
    setImageError(null);
    setImageUploading(true);
    try {
      // GIFs keep their animation (uploaded as-is, within the bucket limit);
      // everything else is downscaled + re-encoded to a compact JPEG.
      let uploadFile = file;
      let contentType = file.type;
      if (file.type === "image/gif") {
        if (file.size > EVENT_IMAGE_BUCKET_MAX_BYTES) {
          setImageError("That GIF is over 5MB — pick a smaller one, or use a JPEG or PNG.");
          return;
        }
      } else {
        uploadFile = await downscaleImageToJpeg(file, { maxEdge: 1600, quality: 0.82 });
        contentType = "image/jpeg";
      }
      const target = await createEventImageUpload({ contentType });
      if ("error" in target) {
        setImageError(target.error);
        return;
      }
      const { error } = await getBrowserSupabase()
        .storage.from(EVENT_IMAGE_BUCKET)
        .uploadToSignedUrl(target.path, target.token, uploadFile);
      if (error) {
        setImageError("Something went wrong uploading that image. Please try again.");
        return;
      }
      setImagePath(target.path);
    } catch {
      setImageError(
        "We couldn’t process that image. If it’s an iPhone HEIC photo, set your camera to “Most Compatible”, or upload a JPEG or PNG."
      );
    } finally {
      setImageUploading(false);
    }
  }

  function onImageRemove() {
    // Bin a fresh (unsaved) upload so it doesn't orphan; leave a saved existing
    // image for updateEvent to clean on save.
    if (imagePath) void discardEventImageUpload({ path: imagePath }).catch(() => {});
    setImageFile(null);
    setImagePath(null);
    setRemoveImage(true);
    setImageError(null);
  }

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
      setImageFile(null);
      setImagePath(null);
      setImageUploading(false);
      setRemoveImage(false);
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
    // Don't submit mid-upload -- the image path isn't known yet.
    if (imageUploading) {
      setImageError("Hang on — the image is still uploading.");
      document.getElementById(FIELD_IDS.imageUrl)?.focus();
      return;
    }
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
    fd.set("capacity", values.capacity.trim());
    fd.set("startsAt", localInputToIso(values.startsLocal) ?? "");
    fd.set("endsAt", localInputToIso(values.endsLocal) ?? "");
    if (imagePath) fd.set("imagePath", imagePath);
    if (removeImage) fd.set("removeImage", "true");
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
                id={FIELD_IDS.startsAt}
                label="Starts"
                type="datetime-local"
                value={values.startsLocal}
                onChange={(e) => onStartChange(e.target.value)}
                error={errors.startsAt}
                suppressHydrationWarning
              />
              <TextField
                id={FIELD_IDS.endsAt}
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
            <div className="sm:max-w-xs">
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
            </div>
            <ImageUploadField
              id={FIELD_IDS.imageUrl}
              label="Image"
              optional
              previewUrl={imagePreviewUrl}
              fileLabel={imageFileLabel}
              uploading={imageUploading}
              error={errors.imageUrl}
              hint="A hero image shown on the event card and detail page. Big photos are shrunk for you."
              onSelect={onImageSelect}
              onRemove={onImageRemove}
            />
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
            disabled={isPending || imageUploading}
            className="bg-brand-accent px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending
              ? "Saving…"
              : imageUploading
                ? "Uploading image…"
                : isEdit
                  ? "Save changes"
                  : publish
                    ? "Publish event"
                    : "Create draft"}
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

      <EventPreviewCard values={values} previewUrl={imagePreviewUrl} isEdit={isEdit} />
    </div>
  );
}

/** Live "this is how it'll look" card, mirroring the member event card. */
function EventPreviewCard({
  values,
  previewUrl,
  isEdit,
}: {
  values: EventFieldValues;
  previewUrl: string | null;
  isEdit: boolean;
}) {
  const startIso = localInputToIso(values.startsLocal);
  const endIso = localInputToIso(values.endsLocal);
  const when = useMemo(() => (startIso ? formatEventWhen(startIso, endIso) : null), [startIso, endIso]);
  const cap = values.capacity.trim();

  return (
    // On mobile the preview leads (order-first) so it's visible while filling
    // the top fields, and it's collapsible (<details>) so it can be tucked away
    // when it's in the way. On desktop it drops back beside the form (order-none)
    // as a sticky side card, and the summary is inert (pointer-events-none) +
    // always-open, so it reads exactly as the fixed panel it was before.
    <aside className="order-first lg:order-none lg:sticky lg:top-6 lg:self-start">
      <details open className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-1 lg:cursor-default lg:py-0 lg:pointer-events-none [&::-webkit-details-marker]:hidden">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted">Live preview</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180 lg:hidden"
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>

        <div className="mt-2 border border-rule-border">
          {previewUrl ? (
            <div className="aspect-[16/9] w-full overflow-hidden border-b border-rule-border">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL / admin image preview */}
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
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
      </details>
    </aside>
  );
}
