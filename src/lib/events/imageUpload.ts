import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// createClient() is typed with a schema union; storage access doesn't care which
// one, so accept either -- same pattern as lib/notices/videoUpload.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any>;

export const EVENT_IMAGE_BUCKET = "event-images";

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type EventImageUploadTarget = { path: string; token: string } | { error: string };

/**
 * Mint a short-lived SIGNED UPLOAD URL for an event image so the browser can PUT
 * the (client-downscaled) file straight to Storage -- the same direct-to-Storage
 * pattern as notice videos. Two payoffs over the old stream-through-the-action
 * approach: a failed image can no longer block the whole event save, and the
 * file never crosses the Server Action / platform body limit.
 *
 * The object lives in the author's own folder (`{userId}/...`) so it satisfies
 * the event-images INSERT RLS ("own folder" + ntitt_admin/hr_admin). Called with
 * the author's OWN session client, so minting the URL is itself gated by that
 * policy; the bucket still enforces its size + MIME limits on the actual upload,
 * so the token can't be used to smuggle a disallowed file.
 */
export async function createEventImageUploadTarget(
  supabase: AnySupabaseClient,
  userId: string,
  contentType: string
): Promise<EventImageUploadTarget> {
  const ext = EXTENSION_BY_TYPE[contentType];
  if (!ext) {
    return { error: "Images must be JPEG, PNG, WebP, or GIF." };
  }
  const path = `${userId}/${randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from(EVENT_IMAGE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[createEventImageUploadTarget] createSignedUploadUrl failed", error);
    return { error: "Couldn’t start the image upload. Please try again." };
  }
  return { path: data.path, token: data.token };
}

/** Shape + ownership guard for a client-submitted image path: it must be our own
 *  `{userId}/{uuid}.{ext}` layout AND sit in the caller's own folder, so a client
 *  can't point the row at an object in someone else's folder. */
export function isEventImagePath(userId: string, path: string): boolean {
  const parts = path.split("/");
  if (parts.length !== 2) return false;
  if (parts[0] !== userId) return false;
  return /^[0-9a-fA-F-]{8,}\.(jpg|png|webp|gif)$/.test(parts[1]);
}

/** Resolve the public URL for a stored event-image path. `events.image_url` keeps
 *  holding a URL (no schema change), so a moved/downscaled asset renders exactly
 *  as a pasted URL always did. */
export function eventImageUrlFromPath(supabase: AnySupabaseClient, path: string): string {
  return supabase.storage.from(EVENT_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * The object path within `event-images` for one of our own public URLs, or null
 * for anything else (an external / previously-pasted URL). Used so cleanup only
 * ever deletes assets we uploaded, never an arbitrary URL an older event carries.
 */
export function eventImagePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${EVENT_IMAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length).split("?")[0];
  return path || null;
}

/**
 * Best-effort delete of a previously-uploaded event image when it's replaced or
 * removed. No-op for external URLs. Pass a service-role client so it succeeds
 * regardless of which author uploaded the asset (an ntitt_admin may edit an
 * hr_admin's event and vice-versa). Never throws -- cleanup must not fail a save.
 */
export async function deleteEventImageByUrl(
  admin: AnySupabaseClient,
  url: string | null | undefined
): Promise<void> {
  const path = eventImagePathFromUrl(url);
  if (!path) return;
  try {
    await admin.storage.from(EVENT_IMAGE_BUCKET).remove([path]);
  } catch {
    /* non-fatal: the save already succeeded */
  }
}

/** Best-effort delete of a just-uploaded object by PATH -- for discarding a fresh
 *  pick the author replaced or removed before saving (direct uploads happen the
 *  moment a file is chosen, so a discarded pick would otherwise orphan). Never
 *  throws. */
export async function deleteEventImageByPath(
  client: AnySupabaseClient,
  path: string | null | undefined
): Promise<void> {
  if (!path) return;
  try {
    await client.storage.from(EVENT_IMAGE_BUCKET).remove([path]);
  } catch {
    /* non-fatal */
  }
}
