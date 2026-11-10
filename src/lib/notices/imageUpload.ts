import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// createClient() is typed with a schema union; storage access doesn't care which
// one, so accept either -- same pattern as lib/content/assetUpload.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any>;

const BUCKET = "notice-media";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MiB, matches the bucket's file_size_limit
// notice-media is PRIVATE (20261110020000); a stored image is served via a
// short-lived SIGNED URL rather than a permanent public link. 1h is ample: the
// notice surfaces (Today board + Studio) are server-rendered per request, so a
// fresh URL is minted on every load.
const NOTICE_MEDIA_URL_TTL_SECONDS = 60 * 60;
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** The user-facing rule, shared with the client-side pre-check so messages match. */
export const NOTICE_IMAGE_RULE = "Images must be JPEG, PNG, WebP, or GIF, and under 5MB.";

export type NoticeImageUploadResult = { path: string } | { error: string };

/**
 * Uploads a notice image to the `notice-media` bucket. The bucket's write RLS is
 * ntitt_admin-only (see the notices migration), so this must be called with the
 * admin's own request-scoped session client -- the same server-side-upload
 * pattern as uploadContentAsset. Returns the object PATH (not a URL); the bucket
 * is private, so the Today widget + Studio sign the stored path at read time
 * (noticeImageUrl).
 */
export async function uploadNoticeImage(supabase: AnyClient, file: File): Promise<NoticeImageUploadResult> {
  const extension = EXTENSION_BY_TYPE[file.type];
  if (!extension) {
    return { error: "Images must be JPEG, PNG, WebP, or GIF." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Images must be under 5MB." };
  }

  const path = `notice/${randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (error) {
    // Log the real Storage cause (e.g. "Bucket not found", an RLS denial) --
    // the friendly message alone left operators with no signal to debug from.
    console.error("[uploadNoticeImage] storage upload failed", error);
    return { error: "Something went wrong uploading that image. Please try again." };
  }
  return { path };
}

/**
 * A short-lived signed URL for a stored notice image path, or null if there's no
 * path or it can't be signed (so a caller renders without the image rather than a
 * broken link). notice-media is private, so this replaces the old getPublicUrl.
 */
export async function noticeImageUrl(
  supabase: AnyClient,
  path: string | null | undefined
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, NOTICE_MEDIA_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

/**
 * Best-effort delete of a previously-uploaded notice image when it's replaced or
 * the notice is deleted / its media type changed away from image. Pass a
 * service-role client so it succeeds regardless. Never throws -- cleanup must not
 * fail a save.
 */
export async function deleteNoticeImageByPath(admin: AnyClient, path: string | null | undefined): Promise<void> {
  if (!path) return;
  try {
    await admin.storage.from(BUCKET).remove([path]);
  } catch {
    /* non-fatal: the save already succeeded */
  }
}
