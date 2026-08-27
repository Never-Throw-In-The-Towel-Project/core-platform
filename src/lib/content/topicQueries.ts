import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentTopic, ContentTopicWithCount } from "@/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers pass whichever client they hold
type AnyClient = SupabaseClient<any, any>;

/**
 * The Library topic taxonomy, ordered for display (sort_order, then label).
 * Authenticated-read (RLS), so members and the Brain alike list the same rows;
 * the taxonomy is editable in the Brain, so always read it — never hardcode the
 * eight seeded slugs.
 */
export async function listTopics(supabase: AnyClient): Promise<ContentTopic[]> {
  const { data } = await supabase
    .from("content_topics")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  return (data as ContentTopic[] | null) ?? [];
}

/**
 * Topics decorated with how many published, viewer-visible items carry each —
 * the "Browse by topic" rooms and the count next to a topic filter. Counts come
 * from the assignment join INNER-joined to content_items, so content_items' own
 * RLS (published + channel-visible) filters them: a member never counts drafts
 * or another company's targeted content. Text items are excluded, matching the
 * Library grid. Tallied in memory (one query) rather than N per-topic counts.
 */
export async function listTopicsWithCounts(supabase: AnyClient): Promise<ContentTopicWithCount[]> {
  const topics = await listTopics(supabase);
  if (topics.length === 0) return [];

  const { data } = await supabase
    .from("content_item_topics")
    .select("topic_id, content_items!inner(is_published, type)")
    .eq("content_items.is_published", true)
    .neq("content_items.type", "text");

  const counts = new Map<string, number>();
  for (const row of (data as { topic_id: string }[] | null) ?? []) {
    counts.set(row.topic_id, (counts.get(row.topic_id) ?? 0) + 1);
  }

  return topics.map((t) => ({ ...t, count: counts.get(t.id) ?? 0 }));
}
