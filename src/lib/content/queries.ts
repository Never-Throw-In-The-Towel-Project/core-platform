import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentItem } from "@/types/database";
import { escapeFilterValue } from "@/lib/supabase/filterEscape";

// createClient() is typed with a schema union; content lives in `public`, but
// callers pass whichever client instance they already have, same pattern as
// lib/community/queries.ts and lib/community/imageUpload.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any>;

/**
 * The Content Library list. Published items only; channel visibility is
 * enforced by the `content_items` RLS policy for the caller's own session
 * (global items, plus anything placed on the caller's company) -- this query
 * doesn't and shouldn't re-implement that filter. Search matches title or
 * tags, escaped through the shared PostgREST filter escaper.
 */
export async function listContentItems(
  supabase: AnyClient,
  opts: { q?: string; category?: string } = {}
): Promise<ContentItem[]> {
  let query = supabase
    .from("content_items")
    .select("*")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (opts.category) {
    query = query.eq("category", opts.category);
  }
  if (opts.q) {
    const escaped = escapeFilterValue(opts.q);
    query = query.or(`title.ilike."%${escaped}%",tags.cs.{"${escaped}"}`);
  }

  const { data } = await query;
  return (data as ContentItem[] | null) ?? [];
}

/** A single item for the watch/read page. RLS applies as for the list. */
export async function getContentItem(supabase: AnyClient, id: string): Promise<ContentItem | null> {
  const { data } = await supabase.from("content_items").select("*").eq("id", id).maybeSingle();
  return (data as ContentItem | null) ?? null;
}

/**
 * Published items tagged for a specific ISO weekday (1 = Mon … 7 = Sun) --
 * the bank the day-of-week carousel rotates through. Channel visibility is
 * again enforced by RLS.
 */
export async function getDayContent(supabase: AnyClient, isoWeekday: number): Promise<ContentItem[]> {
  const { data } = await supabase
    .from("content_items")
    .select("*")
    .eq("is_published", true)
    .eq("day_of_week", isoWeekday)
    .order("created_at", { ascending: false });
  return (data as ContentItem[] | null) ?? [];
}

/**
 * Everything for the Super Admin Studio, including unpublished drafts. Only
 * an ntitt_admin session sees drafts (the "ntitt admins read all content" RLS
 * policy); a non-admin caller would get published rows only, so this is safe
 * to call after requireNtittAdmin().
 */
export async function listAllContentForAdmin(supabase: AnyClient): Promise<ContentItem[]> {
  const { data } = await supabase
    .from("content_items")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as ContentItem[] | null) ?? [];
}
