// Shared Notice-field constraints + client-side validation. Mirrors the
// server-side checks in src/lib/actions/notices.ts, which stay the real
// authority (a Server Action is reachable independently of how its form
// renders). It exists so the authoring form can surface a per-field message the
// instant a field is wrong -- and repopulate + highlight rather than wiping the
// whole form, the same shape the events form uses.
//
// Error keys deliberately match the SERVER field names, so a client-caught error
// and a server-returned fieldError share one map shape and merge without
// translation.

import type { NoticeMediaKind } from "@/types/database";

export const NOTICE_LIMITS = {
  title: 120,
  body: 1000,
  ctaLabel: 40,
  ctaUrl: 2000,
} as const;

/** The Vimeo numeric-only rule, identical to the content importer's (csvImport). */
export const VIMEO_ID_RULE = "Enter the numeric Vimeo ID only (e.g. 123456789), not a URL.";
const VIMEO_ID_RE = /^\d+$/;

/** The raw values the form holds. `hasImage` = an image is present for this
 *  notice (either one already saved and kept, or a newly-picked file). */
export type NoticeFieldValues = {
  title: string;
  body: string;
  mediaKind: NoticeMediaKind;
  vimeoId: string;
  hasImage: boolean;
  /** A video is present for this notice (a freshly-uploaded one, or one already
   *  saved and kept). Set only when mediaKind is 'video'. */
  hasVideo: boolean;
  weekday: string; // "" (any) or "1".."7"
  startsOn: string; // "" or yyyy-mm-dd
  endsOn: string;
  ctaLabel: string;
  ctaUrl: string;
};

export type NoticeFieldKey =
  | "title"
  | "body"
  | "vimeoId"
  | "image"
  | "video"
  | "weekday"
  | "startsOn"
  | "endsOn"
  | "ctaLabel"
  | "ctaUrl";

export type NoticeFieldErrors = Partial<Record<NoticeFieldKey, string>>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Lax URL check -- parity with the server's URL parse. */
function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate the form's current values. Returns a map of field -> message for
 * every invalid field (empty object when the form is ready to submit). Field
 * order matches the visual order so "focus the first error" lands on the top one.
 */
export function validateNoticeFields(v: NoticeFieldValues): NoticeFieldErrors {
  const errors: NoticeFieldErrors = {};

  const title = v.title.trim();
  if (!title) errors.title = "Give the notice a headline.";
  else if (title.length > NOTICE_LIMITS.title)
    errors.title = `Keep the headline under ${NOTICE_LIMITS.title} characters.`;

  if (v.body.trim().length > NOTICE_LIMITS.body)
    errors.body = `Keep the message under ${NOTICE_LIMITS.body} characters.`;

  if (v.mediaKind === "vimeo") {
    const id = v.vimeoId.trim();
    if (!id) errors.vimeoId = "Add the Vimeo ID for the video.";
    else if (!VIMEO_ID_RE.test(id)) errors.vimeoId = VIMEO_ID_RULE;
  } else if (v.mediaKind === "image") {
    if (!v.hasImage) errors.image = "Add an image, or choose a different media type.";
  } else if (v.mediaKind === "video") {
    if (!v.hasVideo) errors.video = "Upload a video, or choose a different media type.";
  }

  if (v.weekday) {
    const n = Number(v.weekday);
    if (!Number.isInteger(n) || n < 1 || n > 7) errors.weekday = "Pick a valid day of the week.";
  }

  const startsOn = v.startsOn.trim();
  const endsOn = v.endsOn.trim();
  if (startsOn && !DATE_RE.test(startsOn)) errors.startsOn = "Enter a valid start date.";
  if (endsOn && !DATE_RE.test(endsOn)) errors.endsOn = "Enter a valid end date.";
  if (
    startsOn &&
    endsOn &&
    DATE_RE.test(startsOn) &&
    DATE_RE.test(endsOn) &&
    endsOn < startsOn
  ) {
    errors.endsOn = "The end date can’t be before the start date.";
  }

  const ctaLabel = v.ctaLabel.trim();
  const ctaUrl = v.ctaUrl.trim();
  if (ctaLabel.length > NOTICE_LIMITS.ctaLabel)
    errors.ctaLabel = `Keep the button label under ${NOTICE_LIMITS.ctaLabel} characters.`;
  if (ctaUrl) {
    if (!isValidUrl(ctaUrl)) errors.ctaUrl = "The button link needs to be a valid URL (including https://).";
    else if (ctaUrl.length > NOTICE_LIMITS.ctaUrl)
      errors.ctaUrl = `Keep the button link under ${NOTICE_LIMITS.ctaUrl} characters.`;
  }
  // A label with no link is meaningless (and the DB CHECK forbids it).
  if (ctaLabel && !ctaUrl) errors.ctaLabel = "Add a link for the button, or clear the label.";

  return errors;
}

/** Client-side image pre-check, mirroring the server (uploadNoticeImage) so a bad
 *  pick is rejected instantly with the same message instead of round-tripping. */
export const NOTICE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function validateNoticeImageFile(file: File): string | null {
  if (!IMAGE_TYPES.has(file.type)) return "Images must be JPEG, PNG, WebP, or GIF.";
  if (file.size > NOTICE_IMAGE_MAX_BYTES) return "Images must be under 5MB.";
  return null;
}

/** Client-side video pre-check, mirroring the notice-videos bucket limits so a
 *  bad pick is rejected before the (large) upload even starts. */
export const NOTICE_VIDEO_MAX_BYTES = 200 * 1024 * 1024;
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime", "video/ogg"]);

export function validateNoticeVideoFile(file: File): string | null {
  if (!VIDEO_TYPES.has(file.type)) return "Videos must be MP4, WebM, MOV, or OGG.";
  if (file.size > NOTICE_VIDEO_MAX_BYTES) return "Videos must be under 200MB.";
  return null;
}

/** The first invalid field in visual order -- used to move focus on submit. */
export function firstNoticeErrorField(errors: NoticeFieldErrors): NoticeFieldKey | null {
  const order: NoticeFieldKey[] = [
    "title",
    "body",
    "vimeoId",
    "image",
    "video",
    "weekday",
    "startsOn",
    "endsOn",
    "ctaLabel",
    "ctaUrl",
  ];
  return order.find((k) => errors[k]) ?? null;
}

/** Normalise a Vimeo id: trimmed, numeric only, or null. Server-side guard so a
 *  bad value never reaches the notices_media_for_kind CHECK. */
export function normaliseVimeoId(raw: string | null | undefined): string | null {
  const id = (raw ?? "").trim();
  return VIMEO_ID_RE.test(id) ? id : null;
}
