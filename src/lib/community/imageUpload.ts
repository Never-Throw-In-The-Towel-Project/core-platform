import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// createClient() is typed with a schema union ("public" | "private") since
// it takes a runtime schema parameter -- storage access doesn't care which
// one the caller picked, so accept either, same pattern as
// src/lib/dashboard/aggregates.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any>;

const MAX_BYTES = 5 * 1024 * 1024; // 5 MiB, matches the storage.buckets file_size_limit in the Phase 9 migration
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type ImageUploadResult = { url: string } | { error: string };

/**
 * Uploads a Community post photo to the `community-images` bucket, scoped
 * to the uploader's own folder (`{userId}/...`) -- the same boundary the
 * bucket's RLS policies enforce (Phase 9 migration), checked here too so a
 * bad upload fails with a clear message instead of a generic Storage error.
 * Called from submitCommunityPost with the request-scoped client so the
 * upload runs as the user's own session, not service-role.
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
    .from("community-images")
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    // Log the real Storage cause (e.g. "Bucket not found", an RLS denial) --
    // the friendly message alone left operators with no signal to debug from.
    console.error("[uploadCommunityImage] storage upload failed", uploadError);
    return { error: "Something went wrong uploading that photo. Please try again." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("community-images").getPublicUrl(path);

  return { url: publicUrl };
}
