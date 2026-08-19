"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createNotice, updateNotice, createNoticeVideoUpload } from "@/lib/actions/notices";
import { initialNoticeFormState } from "@/lib/notices/noticeFormState";
import {
  NOTICE_LIMITS,
  firstNoticeErrorField,
  validateNoticeFields,
  validateNoticeImageFile,
  validateNoticeVideoFile,
  type NoticeFieldErrors,
  type NoticeFieldKey,
  type NoticeFieldValues,
} from "@/lib/notices/validation";
import { getBrowserSupabase } from "@/lib/supabase/browserUpload";
import { FormSection, Switch, TextAreaField, TextField } from "@/components/ui/form";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { VideoUploadField } from "@/components/ui/VideoUploadField";
import { NoticeCard } from "@/components/notices/NoticeCard";
import type { NoticeMediaKind } from "@/types/database";
import type { NoticeView } from "@/lib/notices/queries";

const NOTICE_VIDEO_BUCKET = "notice-videos";

/** DOM ids keyed by the (server-shaped) error keys, for "focus the first error". */
const FIELD_IDS: Record<NoticeFieldKey, string> = {
  title: "notice-title",
  body: "notice-body",
  vimeoId: "notice-vimeo",
  image: "notice-image",
  video: "notice-video",
  weekday: "notice-weekday",
  startsOn: "notice-starts",
  endsOn: "notice-ends",
  ctaLabel: "notice-cta-label",
  ctaUrl: "notice-cta-url",
};

const MEDIA_OPTIONS: { value: NoticeMediaKind; label: string; hint: string }[] = [
  { value: "none", label: "Text only", hint: "A headline and a message." },
  { value: "vimeo", label: "Vimeo video", hint: "Embed a Vimeo clip." },
  { value: "image", label: "Image", hint: "A picture or a quote card." },
  { value: "video", label: "Video file", hint: "Upload a video from your device." },
];

const WEEKDAYS: { value: string; label: string }[] = [
  { value: "", label: "Any day" },
  { value: "1", label: "Mondays" },
  { value: "2", label: "Tuesdays" },
  { value: "3", label: "Wednesdays" },
  { value: "4", label: "Thursdays" },
  { value: "5", label: "Fridays" },
  { value: "6", label: "Saturdays" },
  { value: "7", label: "Sundays" },
];

const SELECT_CLASS =
  "mt-1 w-full border border-rule-border bg-transparent px-3 py-2 text-sm transition-colors focus:border-foreground";
const SUBLABEL = "block text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted";

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function blankValues(): NoticeFieldValues {
  return {
    title: "",
    body: "",
    mediaKind: "none",
    vimeoId: "",
    hasImage: false,
    hasVideo: false,
    weekday: "",
    startsOn: "",
    endsOn: "",
    ctaLabel: "",
    ctaUrl: "",
  };
}

function valuesFromNotice(n: NoticeView): NoticeFieldValues {
  return {
    title: n.title ?? "",
    body: n.body ?? "",
    mediaKind: n.media_kind,
    vimeoId: n.vimeo_id ?? "",
    hasImage: n.media_kind === "image" && Boolean(n.image_url),
    hasVideo: n.media_kind === "video" && Boolean(n.video_url),
    weekday: n.weekday != null ? String(n.weekday) : "",
    startsOn: n.starts_on ?? "",
    endsOn: n.ends_on ?? "",
    ctaLabel: n.cta_label ?? "",
    ctaUrl: n.cta_url ?? "",
  };
}

/**
 * Create or edit a Notice Board card. When `notice` is passed it's edit mode
 * (updateNotice); otherwise create mode (createNotice, with a publish-now
 * toggle). ntitt_admin only; enforced again server-side and by RLS.
 *
 * Fully CONTROLLED, exactly like EventStudioForm: every value lives in React
 * state so a validation error can never wipe what was typed. Client validation
 * mirrors the server rules and highlights the exact field(s); the server stays
 * the authority. A live preview (the real member card) updates as you type.
 */
export function NoticeStudioForm({ notice }: { notice?: NoticeView }) {
  const isEdit = Boolean(notice);
  const [state, formAction, isPending] = useActionState(
    isEdit ? updateNotice : createNotice,
    initialNoticeFormState
  );

  const [values, setValues] = useState<NoticeFieldValues>(() =>
    notice ? valuesFromNotice(notice) : blankValues()
  );
  const [errors, setErrors] = useState<NoticeFieldErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [publish, setPublish] = useState(false);
  const [priority, setPriority] = useState<string>(notice ? String(notice.priority) : "0");

  // Image state, mirroring EventStudioForm: a freshly-picked File and whether the
  // existing (edit-mode) image has been cleared. The object URL is created once
  // and shared with the live preview, revoked on change/unmount.
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const existingImageUrl = notice?.image_url ?? null;
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

  // Video state: unlike images (streamed through the action), a video file is
  // uploaded DIRECT to Storage from here — `videoPath` is the resulting object
  // path submitted to the action, `videoFile` drives the local preview, and
  // `videoUploading` gates submit while the (large) PUT is in flight.
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [removeVideo, setRemoveVideo] = useState(false);
  const existingVideoUrl = notice?.video_url ?? null;
  const existingVideoPath = notice?.video_path ?? null;
  const videoObjectUrl = useMemo(() => (videoFile ? URL.createObjectURL(videoFile) : null), [videoFile]);
  useEffect(() => {
    return () => {
      if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
    };
  }, [videoObjectUrl]);
  const videoPreviewUrl = videoObjectUrl ?? (removeVideo ? null : existingVideoUrl);
  const videoFileLabel = videoFile
    ? `${videoFile.name} · ${prettyBytes(videoFile.size)}`
    : videoPreviewUrl
      ? "Current video"
      : null;
  // The path that will be submitted: a fresh upload, or the kept existing one.
  const effectiveVideoPath = videoPath ?? (removeVideo ? null : existingVideoPath);

  /** The two media-presence flags the validator needs, for a given value set
   *  (media kind may be changing); they depend on the file/upload state above. */
  function mediaFlags(v: NoticeFieldValues): { hasImage: boolean; hasVideo: boolean } {
    return {
      hasImage: v.mediaKind === "image" && Boolean(imageFile || (!removeImage && existingImageUrl)),
      hasVideo: v.mediaKind === "video" && Boolean(effectiveVideoPath),
    };
  }

  function currentValues(): NoticeFieldValues {
    return { ...values, ...mediaFlags(values) };
  }

  function clearImageError() {
    setErrors((prev) => {
      if (!prev.image) return prev;
      const next = { ...prev };
      delete next.image;
      return next;
    });
  }
  function onImageSelect(file: File) {
    const err = validateNoticeImageFile(file);
    if (err) {
      setErrors((prev) => ({ ...prev, image: err }));
      return;
    }
    setImageFile(file);
    setRemoveImage(false);
    clearImageError();
  }
  function onImageRemove() {
    setImageFile(null);
    setRemoveImage(true);
    clearImageError();
  }

  function setVideoError(msg: string | null) {
    setErrors((prev) => {
      if (msg) return { ...prev, video: msg };
      if (!prev.video) return prev;
      const next = { ...prev };
      delete next.video;
      return next;
    });
  }

  // Direct-to-Storage upload: mint a signed URL server-side (ntitt_admin only),
  // then PUT the file straight to the notice-videos bucket so it never crosses
  // the Server Action body limit. setState after each await is fine in an event
  // handler (the lint rule only forbids it inside effects).
  async function onVideoSelect(file: File) {
    const bad = validateNoticeVideoFile(file);
    if (bad) {
      setVideoError(bad);
      return;
    }
    setVideoFile(file); // show the local preview immediately
    setRemoveVideo(false);
    setVideoPath(null);
    setVideoError(null);
    setVideoUploading(true);
    try {
      const target = await createNoticeVideoUpload({ contentType: file.type });
      if ("error" in target) {
        setVideoError(target.error);
        return;
      }
      const { error } = await getBrowserSupabase()
        .storage.from(NOTICE_VIDEO_BUCKET)
        .uploadToSignedUrl(target.path, target.token, file);
      if (error) {
        setVideoError("Something went wrong uploading that video. Please try again.");
        return;
      }
      setVideoPath(target.path);
    } catch {
      setVideoError("Something went wrong uploading that video. Please try again.");
    } finally {
      setVideoUploading(false);
    }
  }

  function onVideoRemove() {
    setVideoFile(null);
    setVideoPath(null);
    setRemoveVideo(true);
    setVideoError(null);
  }

  // Clear the form on a fresh CREATE success — adjust state DURING render (React's
  // documented pattern, matching ContentStudioForm/EventStudioForm) rather than
  // in an effect, which would trip the cascading-render lint rule.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (!isEdit && state.status === "success") {
      setValues(blankValues());
      setErrors({});
      setSubmitAttempted(false);
      setPublish(false);
      setPriority("0");
      setImageFile(null);
      setRemoveImage(false);
      setVideoFile(null);
      setVideoPath(null);
      setRemoveVideo(false);
      setVideoUploading(false);
    } else if (state.status === "error" && state.fieldErrors) {
      setErrors(state.fieldErrors);
      setSubmitAttempted(true);
    }
  }

  function applyValues(next: NoticeFieldValues) {
    setValues(next);
    if (submitAttempted) setErrors(validateNoticeFields({ ...next, ...mediaFlags(next) }));
  }

  function patch(next: Partial<NoticeFieldValues>) {
    applyValues({ ...values, ...next });
  }

  function handleSubmit() {
    setSubmitAttempted(true);
    // Don't submit mid-upload — the video_path isn't known yet.
    if (values.mediaKind === "video" && videoUploading) {
      setVideoError("Hang on — the video is still uploading.");
      document.getElementById(FIELD_IDS.video)?.focus();
      return;
    }
    const found = validateNoticeFields(currentValues());
    setErrors(found);
    const firstKey = firstNoticeErrorField(found);
    if (firstKey) {
      document.getElementById(FIELD_IDS[firstKey])?.focus();
      return;
    }

    const fd = new FormData();
    fd.set("title", values.title.trim());
    fd.set("body", values.body.trim());
    fd.set("mediaKind", values.mediaKind);
    fd.set("vimeoId", values.vimeoId.trim());
    fd.set("weekday", values.weekday);
    fd.set("startsOn", values.startsOn);
    fd.set("endsOn", values.endsOn);
    fd.set("ctaLabel", values.ctaLabel.trim());
    fd.set("ctaUrl", values.ctaUrl.trim());
    fd.set("priority", priority.trim() || "0");
    if (values.mediaKind === "image" && imageFile) fd.set("image", imageFile);
    if (values.mediaKind === "video" && effectiveVideoPath) fd.set("videoPath", effectiveVideoPath);
    if (isEdit && notice) fd.set("id", notice.id);
    if (!isEdit && publish) fd.set("publish", "true");
    formAction(fd);
  }

  const serverMessage = state.status === "error" ? state.message : null;
  const isSuccess = state.status === "success";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form action={handleSubmit} noValidate className="min-w-0 border border-rule-border">
        <div className="space-y-8 p-5 sm:p-6">
          <FormSection title="Message">
            <TextField
              id={FIELD_IDS.title}
              label="Headline"
              value={values.title}
              onChange={(e) => patch({ title: e.target.value })}
              error={errors.title}
              maxLength={NOTICE_LIMITS.title}
              placeholder="Start the week strong 💪"
              autoComplete="off"
            />
            <TextAreaField
              id={FIELD_IDS.body}
              label="Message"
              optional
              rows={4}
              value={values.body}
              onChange={(e) => patch({ body: e.target.value })}
              error={errors.body}
              maxLength={NOTICE_LIMITS.body}
              placeholder="A short line or two to go with it."
            />
          </FormSection>

          <FormSection title="Media" description="Add a video or an image, or keep it text-only.">
            <fieldset>
              <legend className={SUBLABEL}>Type</legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MEDIA_OPTIONS.map((opt) => {
                  const active = values.mediaKind === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={
                        "flex cursor-pointer flex-col gap-0.5 border p-3 transition-colors " +
                        (active ? "border-foreground bg-foreground/[0.03]" : "border-rule-border hover:border-foreground")
                      }
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="notice-media-kind"
                          value={opt.value}
                          checked={active}
                          onChange={() => patch({ mediaKind: opt.value })}
                          className="accent-brand-accent"
                        />
                        <span className="text-sm font-extrabold">{opt.label}</span>
                      </span>
                      <span className="text-xs text-muted">{opt.hint}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {values.mediaKind === "vimeo" ? (
              <TextField
                id={FIELD_IDS.vimeoId}
                label="Vimeo ID"
                value={values.vimeoId}
                onChange={(e) => patch({ vimeoId: e.target.value })}
                error={errors.vimeoId}
                inputMode="numeric"
                placeholder="123456789"
                hint="The numeric ID from the Vimeo URL (vimeo.com/123456789)."
              />
            ) : null}

            {values.mediaKind === "image" ? (
              <ImageUploadField
                id={FIELD_IDS.image}
                label="Image"
                previewUrl={imagePreviewUrl}
                fileLabel={imageFileLabel}
                error={errors.image}
                hint="A photo or a quote card. JPEG, PNG, WebP or GIF, up to 5MB."
                onSelect={onImageSelect}
                onRemove={onImageRemove}
              />
            ) : null}

            {values.mediaKind === "video" ? (
              <VideoUploadField
                id={FIELD_IDS.video}
                label="Video"
                previewUrl={videoPreviewUrl}
                fileLabel={videoFileLabel}
                uploading={videoUploading}
                error={errors.video}
                hint="Uploads straight from your device. MP4, WebM, MOV or OGG, up to 200MB."
                onSelect={onVideoSelect}
                onRemove={onVideoRemove}
              />
            ) : null}
          </FormSection>

          <FormSection
            title="When to show it"
            description="Leave everything blank to show it every day. Combine a day and a date window for a one-off."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor={FIELD_IDS.weekday} className={SUBLABEL}>
                  Day of week
                </label>
                <select
                  id={FIELD_IDS.weekday}
                  value={values.weekday}
                  onChange={(e) => patch({ weekday: e.target.value })}
                  className={SELECT_CLASS}
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <TextField
                id={FIELD_IDS.startsOn}
                label="From"
                optional
                type="date"
                value={values.startsOn}
                onChange={(e) => patch({ startsOn: e.target.value })}
                error={errors.startsOn}
              />
              <TextField
                id={FIELD_IDS.endsOn}
                label="Until"
                optional
                type="date"
                value={values.endsOn}
                onChange={(e) => patch({ endsOn: e.target.value })}
                error={errors.endsOn}
              />
            </div>
          </FormSection>

          <FormSection title="Button" description="An optional call-to-action link under the message.">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id={FIELD_IDS.ctaLabel}
                label="Button label"
                optional
                value={values.ctaLabel}
                onChange={(e) => patch({ ctaLabel: e.target.value })}
                error={errors.ctaLabel}
                maxLength={NOTICE_LIMITS.ctaLabel}
                placeholder="Find out more"
              />
              <TextField
                id={FIELD_IDS.ctaUrl}
                label="Button link"
                optional
                type="url"
                value={values.ctaUrl}
                onChange={(e) => patch({ ctaUrl: e.target.value })}
                error={errors.ctaUrl}
                maxLength={NOTICE_LIMITS.ctaUrl}
                placeholder="https://…"
                hint="Where the button goes. Leave blank for no button."
              />
            </div>
          </FormSection>

          <FormSection title="Priority">
            <div className="sm:max-w-[10rem]">
              <TextField
                id="notice-priority"
                label="Priority"
                type="number"
                inputMode="numeric"
                min={0}
                max={1000}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                hint="Higher shows first when several notices qualify."
              />
            </div>
          </FormSection>

          {!isEdit && (
            <FormSection title="Visibility">
              <Switch
                id="notice-publish"
                checked={publish}
                onChange={setPublish}
                label={publish ? "Publish now" : "Save as draft"}
                description={
                  publish
                    ? "Live immediately on every member’s Today page (subject to the schedule above)."
                    : "Hidden from members until you publish it."
                }
              />
            </FormSection>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-rule-hairline bg-background/60 px-5 py-4 sm:px-6">
          <button
            type="submit"
            disabled={isPending || videoUploading}
            className="bg-brand-accent px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending
              ? "Saving…"
              : videoUploading
                ? "Uploading video…"
                : isEdit
                  ? "Save changes"
                  : publish
                    ? "Publish notice"
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

      <NoticePreview values={values} imageUrl={imagePreviewUrl} videoUrl={videoPreviewUrl} isEdit={isEdit} />
    </div>
  );
}

/** Live "this is how it'll look" panel, mirroring the events form. */
function NoticePreview({
  values,
  imageUrl,
  videoUrl,
  isEdit,
}: {
  values: NoticeFieldValues;
  imageUrl: string | null;
  videoUrl: string | null;
  isEdit: boolean;
}) {
  return (
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
        <div className="mt-2">
          <NoticeCard
            embed={false}
            data={{
              title: values.title.trim(),
              body: values.body.trim() || null,
              mediaKind: values.mediaKind,
              vimeoId: values.vimeoId.trim() || null,
              imageUrl,
              videoUrl,
              ctaLabel: values.ctaLabel.trim() || null,
              ctaUrl: values.ctaUrl.trim() || null,
            }}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          {isEdit
            ? "Reflects your unsaved edits. Save to apply."
            : "Updates as you type. This is the card members see on Today."}
        </p>
      </details>
    </aside>
  );
}
