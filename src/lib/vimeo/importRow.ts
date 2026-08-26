import type { VideoCategory } from "@/types/database";

/**
 * Pure mapping from a chosen Vimeo video to a `content_items` insert row, so the
 * shape (and the title/summary limits that mirror ContentInputSchema) are
 * unit-testable without a DB. The server action (lib/actions/vimeoImport.ts)
 * layers auth + dedupe + the insert on top.
 *
 * Imported videos are DRAFTS (is_published:false), NTITT-wide (no channel
 * placements), day-agnostic and untagged — the operator organises, tags, day-
 * assigns and publishes them afterwards with the existing Brain tools. Only the
 * facts Vimeo actually gives us are filled: title, summary, duration, thumbnail
 * and the private play hash.
 */

export interface VimeoImportSelection {
  id: string;
  name: string;
  description: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  hash: string | null;
}

export interface VimeoInsertRow {
  type: "video";
  title: string;
  summary: string | null;
  category: VideoCategory;
  day_of_week: null;
  vimeo_id: string;
  vimeo_hash: string | null;
  asset_path: null;
  external_url: null;
  thumbnail_url: string | null;
  tags: string[];
  duration_seconds: number | null;
  is_published: false;
  folder_id: string | null;
  scheduled_for: null;
  created_by: string;
}

const TITLE_MAX = 200; // mirrors ContentInputSchema.title
const SUMMARY_MAX = 1000; // mirrors ContentInputSchema.summary

export function buildVimeoInsertRow(
  video: VimeoImportSelection,
  opts: { category: VideoCategory; folderId: string | null; createdBy: string }
): VimeoInsertRow {
  const name = video.name?.trim() ?? "";
  const title = (name !== "" ? name : "Untitled Vimeo video").slice(0, TITLE_MAX);
  const desc = video.description?.trim() ?? "";
  const summary = desc !== "" ? desc.slice(0, SUMMARY_MAX) : null;

  return {
    type: "video",
    title,
    summary,
    category: opts.category,
    day_of_week: null,
    vimeo_id: video.id,
    vimeo_hash: video.hash,
    asset_path: null,
    external_url: null,
    thumbnail_url: video.thumbnailUrl,
    tags: [],
    duration_seconds: video.durationSeconds,
    is_published: false,
    folder_id: opts.folderId,
    scheduled_for: null,
    created_by: opts.createdBy,
  };
}
