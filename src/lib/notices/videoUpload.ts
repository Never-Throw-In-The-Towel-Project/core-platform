import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// createClient() is typed with a schema union; storage access doesn't care which
// one, so accept either -- same pattern as lib/notices/imageUpload.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any>;

export const NOTICE_VIDEO_BUCKET = "notice-videos";

// notice-videos is PRIVATE (20261110020000); a stored video is served via a
// short-lived SIGNED URL rather than a permanent public link. 1h is ample: the
// notice surfaces are server-rendered per request, so a fresh URL is minted on
// every load.
const NOTICE_VIDEO_URL_TTL_SECONDS = 60 * 60;

const EXTENSION_BY_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/ogg": "ogv",
};

/** The object extension for an allowed video MIME type, or null for anything else. */
export function noticeVideoExtFromType(contentType: string): string | null {
  return EXTENSION_BY_TYPE[contentType] ?? null;
}

/** Shape guard for a client-submitted video_path: our own `notice/{uuid}.{ext}`
 *  layout, so a rogue path can't be smuggled into the row. */
export function isNoticeVideoPath(path: string): boolean {
  return /^notice\/[0-9a-fA-F-]{8,}\.(mp4|webm|mov|ogv)$/.test(path);
}

export type NoticeVideoUploadTarget = { path: string; token: string } | { error: string };

/**
 * Mint a short-lived SIGNED UPLOAD URL for a notice video, so the browser can PUT
 * the file straight to Storage — video files are far bigger than a Server Action's
 * 6 MiB body limit allows, so they must never pass through the Next.js server.
 * Called with the ntitt_admin's own session client, so creating the signed URL is
 * itself gated by the notice-videos INSERT RLS (ntitt_admin only). The bucket
 * still enforces its size + MIME limits on the actual upload, regardless of the
 * token, so the URL can't be used to smuggle a disallowed file.
 */
export async function createNoticeVideoUploadTarget(
  supabase: AnyClient,
  contentType: string
): Promise<NoticeVideoUploadTarget> {
  const ext = noticeVideoExtFromType(contentType);
  if (!ext) {
    return { error: "Videos must be MP4, WebM, MOV, or OGG." };
  }
  const path = `notice/${randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from(NOTICE_VIDEO_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    return { error: "Couldn’t start the video upload. Please try again." };
  }
  return { path: data.path, token: data.token };
}

/**
 * A short-lived signed URL for a stored notice video path, or null if there's no
 * path or it can't be signed (so a caller renders without the video rather than a
 * broken link). notice-videos is private, so this replaces the old getPublicUrl.
 */
export async function noticeVideoUrl(
  supabase: AnyClient,
  path: string | null | undefined
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage
    .from(NOTICE_VIDEO_BUCKET)
    .createSignedUrl(path, NOTICE_VIDEO_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

/** Best-effort delete of a notice video object when it's replaced, the notice is
 *  deleted, or its media kind moves away from video. Never throws. */
export async function deleteNoticeVideoByPath(admin: AnyClient, path: string | null | undefined): Promise<void> {
  if (!path) return;
  try {
    await admin.storage.from(NOTICE_VIDEO_BUCKET).remove([path]);
  } catch {
    /* non-fatal: the save already succeeded */
  }
}
