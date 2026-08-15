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

/**
 * Public URL for a content-assets object path. content-assets is a public
 * bucket (see the spine migration), so the URL is derived, not signed — the
 * same derivation the member watch page uses (app/(app)/content/[id]/page.tsx).
 */
export function contentAssetUrl(supabase: AnyClient, path: string): string {
  return supabase.storage.from("content-assets").getPublicUrl(path).data.publicUrl;
}

/**
 * Resolve display thumbnail/asset URLs for a set of items, keyed by item id.
 * Only items with an uploaded asset_path get an entry; videos (Vimeo) and
 * external-URL items are rendered from their own fields by the grid. Kept as a
 * lookup so the grid stays a plain client component fed serialisable data.
 */
export function resolveAssetUrls(supabase: AnyClient, items: ContentItem[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of items) {
    if (item.asset_path) {
      map[item.id] = contentAssetUrl(supabase, item.asset_path);
    }
  }
  return map;
}
