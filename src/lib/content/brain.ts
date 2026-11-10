import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentFolder, ContentItem } from "@/types/database";

// Same client-typing note as queries.ts: callers pass whichever client instance
// they already hold; content_folders lives in `public`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any>;

/**
 * The Brain's folders, alphabetical. ntitt_admin only — the content_folders RLS
 * policy is the real gate (verified live by the migration harness); this query
 * doesn't and shouldn't re-implement it. Returns [] for a non-admin session
 * (they see no rows) so callers never special-case null.
 */
export async function listContentFolders(supabase: AnyClient): Promise<ContentFolder[]> {
  const { data } = await supabase
    .from("content_folders")
    .select("*")
    .order("name", { ascending: true });
  return (data as ContentFolder[] | null) ?? [];
}

// content-assets is PRIVATE (20261110000000_content_assets_private.sql), so a
// document/image is served via a short-lived SIGNED URL rather than a permanent
// public link. 1h is ample: these pages are server-rendered per request, so a
// fresh URL is minted on every load; the watch page is open far less than that.
const CONTENT_ASSET_URL_TTL_SECONDS = 60 * 60;

/**
 * A short-lived signed URL for one content-assets object path, or null if it
 * can't be signed (so a caller renders without the asset rather than a broken
 * link). The same derivation the member watch page uses.
 */
export async function contentAssetSignedUrl(supabase: AnyClient, path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("content-assets").createSignedUrl(path, CONTENT_ASSET_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

/**
 * Resolve display asset URLs for a set of items, keyed by item id. Only items
 * with an uploaded asset_path get an entry; videos (Vimeo) and external-URL
 * items are rendered from their own fields by the grid. Signs the whole batch in
 * one round-trip. Kept as a lookup so the grid stays a plain client component
 * fed serialisable data. An item whose URL can't be signed is simply omitted.
 */
export async function resolveAssetUrls(
  supabase: AnyClient,
  items: ContentItem[]
): Promise<Record<string, string>> {
  const withAsset = items.filter((i): i is ContentItem & { asset_path: string } => Boolean(i.asset_path));
  if (withAsset.length === 0) return {};

  const { data } = await supabase.storage
    .from("content-assets")
    .createSignedUrls(withAsset.map((i) => i.asset_path), CONTENT_ASSET_URL_TTL_SECONDS);

  const byPath = new Map<string, string>();
  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) byPath.set(entry.path, entry.signedUrl);
  }

  const map: Record<string, string> = {};
  for (const item of withAsset) {
    const url = byPath.get(item.asset_path);
    if (url) map[item.id] = url;
  }
  return map;
}
