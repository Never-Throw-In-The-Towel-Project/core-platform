import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// createClient() is typed with a schema union ("public" | "private") since
// it takes a runtime schema parameter -- storage access doesn't care which
// one the caller picked, so accept either, same pattern as
// src/lib/dashboard/aggregates.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any>;

const BUCKET = "community-images";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MiB, matches the storage.buckets file_size_limit in the Phase 9 migration
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// The bucket is private (A4): member photos are visible only to signed-in
// members, served as short-lived signed URLs minted at read time rather than
// permanent public links. One hour comfortably outlives a feed render/scroll
// while keeping any leaked URL's usable window small.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

// image_url stores the object PATH, so the result carries the path (not a URL).
export type ImageUploadResult = { path: string } | { error: string };

/**
 * Uploads a Community post photo to the `community-images` bucket, scoped
 * to the uploader's own folder (`{userId}/...`) -- the same boundary the
 * bucket's RLS policies enforce (Phase 9 migration), checked here too so a
 * bad upload fails with a clear message instead of a generic Storage error.
 * Called from submitCommunityPost with the request-scoped client so the
 * upload runs as the user's own session, not service-role.
 *
 * Returns the stored object PATH (not a URL): the bucket is private (A4), so a
 * permanent public URL no longer exists -- the feed signs the path at read time
 * (signCommunityImageUrls).
 */
export async function uploadCommunityImage(
  supabase: AnySupabaseClient,
  userId: string,
  file: File
): Promise<ImageUploadResult> {
  if (!ALLOWED_TYPES.has(file.type)) {
    return { error: "Photos must be JPEG, PNG, WebP, or GIF." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Photos must be under 5MB." };
  }

  const extension = EXTENSION_BY_TYPE[file.type];
  const path = `${userId}/${randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    // Log the real Storage cause (e.g. "Bucket not found", an RLS denial) --
    // the friendly message alone left operators with no signal to debug from.
    console.error("[uploadCommunityImage] storage upload failed", uploadError);
    return { error: "Something went wrong uploading that photo. Please try again." };
  }

  return { path };
}

/**
 * The object path for a stored community image reference. Rows written after A4
 * store the bare path ({userId}/{uuid}.ext); rows written before it stored a
 * full public URL (`.../community-images/{userId}/{uuid}.ext`). Accept either by
 * stripping everything up to and including the bucket segment, so read-time
 * signing works uniformly even if a legacy row escaped the backfill.
 */
export function communityImagePath(stored: string): string {
  const marker = `/${BUCKET}/`;
  const idx = stored.indexOf(marker);
  return idx === -1 ? stored : stored.slice(idx + marker.length);
}

/**
 * Batch-sign community image references for read-time display. The bucket is
 * private (A4), so the feed serves short-lived signed URLs rather than permanent
 * public links. Signing runs as the caller's own (authenticated) session, so the
 * `authenticated users read community images` RLS policy is the real gate --
 * an unauthenticated context signs nothing.
 *
 * Returns a Map keyed by the ORIGINAL stored value (a path or a legacy URL) so
 * callers can look up straight from the row's image_url. References that fail to
 * sign are omitted, so a post whose image can't be signed renders without the
 * image instead of a broken/forbidden link.
 */
export async function signCommunityImageUrls(
  supabase: AnySupabaseClient,
  storedValues: string[]
): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  if (storedValues.length === 0) return signed;

  // De-dupe by object path, but remember every stored value that maps to each
  // path so a single sign result populates all of them.
  const pathToStored = new Map<string, string[]>();
  for (const value of storedValues) {
    const path = communityImagePath(value);
    const list = pathToStored.get(path);
    if (list) list.push(value);
    else pathToStored.set(path, [value]);
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(Array.from(pathToStored.keys()), SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    console.error("[signCommunityImageUrls] batch sign failed", error);
    return signed;
  }

  for (const entry of data) {
    if (entry.error || !entry.signedUrl || !entry.path) continue;
    for (const value of pathToStored.get(entry.path) ?? []) {
      signed.set(value, entry.signedUrl);
    }
  }
  return signed;
}
