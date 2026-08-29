import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentType } from "@/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any>;

const MAX_BYTES = 25 * 1024 * 1024; // 25 MiB, matches the content-assets bucket file_size_limit
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type AssetUploadResult = { path: string } | { error: string };

/**
 * Uploads a document/image content asset to the `content-assets` bucket. The
 * bucket's write RLS is ntitt_admin-only (see the content-spine migration), so
 * this must be called with the admin's own request-scoped session client --
 * the same server-side-upload pattern as uploadCommunityImage. Returns the
 * object path (not a URL); content-assets is public, so the watch page derives
 * the public URL from the path without a signed-URL round-trip.
 */
export async function uploadContentAsset(
  supabase: AnyClient,
  file: File,
  kind: Extract<ContentType, "document" | "image">
): Promise<AssetUploadResult> {
  const extension = EXTENSION_BY_TYPE[file.type];
  if (!extension) {
    return { error: "Files must be JPEG, PNG, WebP, GIF, or PDF." };
  }
  if (kind === "image" && !IMAGE_TYPES.has(file.type)) {
    return { error: "Images must be JPEG, PNG, WebP, or GIF." };
  }
  if (kind === "document" && file.type !== "application/pdf") {
    return { error: "Documents must be a PDF." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Files must be under 25MB." };
  }

  const path = `content/${randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("content-assets").upload(path, file, { contentType: file.type });
  if (error) {
    // Log the real Storage cause (e.g. "Bucket not found", an RLS denial) --
    // the friendly message alone left operators with no signal to debug from.
    console.error("[uploadContentAsset] storage upload failed", error);
    return { error: "Something went wrong uploading that file. Please try again." };
  }
  return { path };
}
