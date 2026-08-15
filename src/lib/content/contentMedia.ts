import type { ContentType } from "@/types/database";

export type ContentMediaCurrent = {
  type: ContentType;
  asset_path: string | null;
  external_url: string | null;
  vimeo_id: string | null;
};

export type ContentMediaUpdateInput = {
  newType: ContentType;
  /** Parsed/validated numeric Vimeo id, if the form supplied one. */
  vimeoId: string | null;
  /** Parsed/validated external url, if the form supplied one. */
  externalUrl: string | null;
  /** Path of a file uploaded on THIS submit (null = no new file). */
  newAssetPath: string | null;
  current: ContentMediaCurrent;
};

export type ContentMediaResolution =
  | {
      ok: true;
      vimeo_id: string | null;
      asset_path: string | null;
      external_url: string | null;
      /** An old asset object orphaned by this update, for the caller to delete after the write. */
      removeAsset: string | null;
    }
  | { ok: false; error: string };

/**
 * Decide the media columns for a content-item UPDATE, honouring the table's
 * `content_items_media_for_type` CHECK (video ⇒ vimeo_id; document/image ⇒
 * asset_path OR external_url) and the "leave media unchanged" case a create never
 * has. Pure: the caller performs the upload (to get `newAssetPath`) and deletes
 * `removeAsset` after the write. See src/lib/actions/content.ts `updateContentItem`.
 *
 * The three mutually-exclusive media columns must always be set so a type change
 * (e.g. video → document) clears the old column and sets the new one in one
 * UPDATE -- otherwise the CHECK rejects the row.
 */
export function resolveContentMediaUpdate(input: ContentMediaUpdateInput): ContentMediaResolution {
  const { newType, vimeoId, externalUrl, newAssetPath, current } = input;

  if (newType === "video") {
    if (!vimeoId) return { ok: false, error: "Add the Vimeo ID for a video." };
    return {
      ok: true,
      vimeo_id: vimeoId,
      asset_path: null,
      external_url: null,
      // Switching away from an uploaded asset orphans it.
      removeAsset: current.asset_path ?? null,
    };
  }

  // document / image
  if (newAssetPath) {
    return {
      ok: true,
      vimeo_id: null,
      asset_path: newAssetPath,
      external_url: null,
      removeAsset: current.asset_path && current.asset_path !== newAssetPath ? current.asset_path : null,
    };
  }
  if (externalUrl) {
    return {
      ok: true,
      vimeo_id: null,
      asset_path: null,
      external_url: externalUrl,
      removeAsset: current.asset_path ?? null,
    };
  }
  // No new media supplied: keep the existing media -- but only if it's still valid
  // for this (unchanged) type. A type change with no new media can't keep the old.
  if (current.type === newType && (current.asset_path || current.external_url)) {
    return {
      ok: true,
      vimeo_id: null,
      asset_path: current.asset_path ?? null,
      external_url: current.external_url ?? null,
      removeAsset: null,
    };
  }
  return { ok: false, error: "Add a file to upload or an external link." };
}
