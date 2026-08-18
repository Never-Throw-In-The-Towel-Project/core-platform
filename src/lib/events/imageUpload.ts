import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// createClient() is typed with a schema union; storage access doesn't care which
// one, so accept either -- same pattern as lib/community/imageUpload.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any>;

const BUCKET = "event-images";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MiB, matches the bucket's file_size_limit
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** The user-facing rule, shared with the client-side pre-check so the messages match. */
export const EVENT_IMAGE_RULE = "Images must be JPEG, PNG, WebP, or GIF, and under 5MB.";

export type EventImageUploadResult = { url: string } | { error: string };

/**
 * Uploads an event image to the `event-images` bucket, scoped to the author's
 * own folder (`{userId}/...`) -- the same boundary the bucket's RLS enforces
 * (ntitt_admin/hr_admin, own folder). Called from the event authoring actions
 * with the request-scoped session client so the upload runs as the author, not
 * service-role. Mirrors uploadCommunityImage.
 */
export async function uploadEventImage(
  supabase: AnySupabaseClient,
  userId: string,
  file: File
): Promise<EventImageUploadResult> {
  if (!ALLOWED_TYPES.has(file.type)) {
    return { error: "Images must be JPEG, PNG, WebP, or GIF." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Images must be under 5MB." };
  }

  const extension = EXTENSION_BY_TYPE[file.type];
  const path = `${userId}/${randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
  });
  if (uploadError) {
    return { error: "Something went wrong uploading that image. Please try again." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: publicUrl };
}

/**
 * The object path within `event-images` for one of our own public URLs, or null
 * for anything else (an external / previously-pasted URL). Used so cleanup only
 * ever deletes assets we uploaded, never an arbitrary URL an older event carries.
 */
export function eventImagePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
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
    await admin.storage.from(BUCKET).remove([path]);
  } catch {
    /* non-fatal: the save already succeeded */
  }
}
