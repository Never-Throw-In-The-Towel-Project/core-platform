import type { VimeoVideoRef } from "@/lib/vimeo/parse";

/**
 * Pure merge of a Vimeo lookup into a content item's video fields, used by the
 * paste-an-ID create path (createContentItem) when Vimeo is connected. The
 * operator's own summary wins if they wrote one; otherwise Vimeo's description
 * fills it. Thumbnail, hash and duration always come from Vimeo (the form never
 * collects them). Pure + unit-tested; the action layers the fetch + insert.
 *
 * Note the create path enriches the summary; the BACKFILL path (existing rows)
 * deliberately touches only thumbnail/hash/duration, never an edited title/summary.
 */
export function enrichVideoFields(
  input: { summary: string | null },
  video: Pick<VimeoVideoRef, "description" | "durationSeconds" | "thumbnailUrl" | "hash">
): { summary: string | null; thumbnail_url: string | null; vimeo_hash: string | null; duration_seconds: number | null } {
  const ownSummary = input.summary?.trim() ?? "";
  return {
    summary: ownSummary !== "" ? input.summary : video.description ?? null,
    thumbnail_url: video.thumbnailUrl ?? null,
    vimeo_hash: video.hash ?? null,
    duration_seconds: video.durationSeconds ?? null,
  };
}
