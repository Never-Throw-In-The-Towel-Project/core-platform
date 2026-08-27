import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { categorizeTopics, type TopicInputItem } from "@/lib/ai/categorizeTopics";
import { listTopics } from "@/lib/content/topicQueries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- session OR service-role client
type AnyClient = SupabaseClient<any, any>;

export type TopicTaggingOutcome = { tagged: number; rows: number };

/**
 * AI-tag a batch of content items with member topics and persist the
 * assignments. The single orchestration reused by BOTH the Vimeo-sync auto-tag
 * (new uploads) and the Brain backfill (existing library): it reads the live
 * taxonomy, classifies via the model, maps slugs back to topic ids, and upserts
 * into content_item_topics. The composite PK + ignoreDuplicates make it
 * idempotent, so a re-run never double-inserts.
 *
 * Best-effort by contract: callers wrap it so a tagging hiccup never fails the
 * import it rode in on. Returns how many items got ≥1 topic and how many join
 * rows were written.
 */
export async function tagContentTopics(
  supabase: AnyClient,
  items: TopicInputItem[]
): Promise<TopicTaggingOutcome> {
  if (items.length === 0) return { tagged: 0, rows: 0 };

  const topics = await listTopics(supabase);
  if (topics.length === 0) return { tagged: 0, rows: 0 };
  const slugToId = new Map(topics.map((t) => [t.slug, t.id]));

  const plan = await categorizeTopics(
    items,
    topics.map((t) => ({ slug: t.slug, label: t.label }))
  );
  if (plan.size === 0) return { tagged: 0, rows: 0 };

  const joinRows: { content_item_id: string; topic_id: string }[] = [];
  for (const [contentItemId, slugs] of plan) {
    for (const slug of slugs) {
      const topicId = slugToId.get(slug);
      if (topicId) joinRows.push({ content_item_id: contentItemId, topic_id: topicId });
    }
  }
  if (joinRows.length === 0) return { tagged: 0, rows: 0 };

  const { error } = await supabase
    .from("content_item_topics")
    .upsert(joinRows, { onConflict: "content_item_id,topic_id", ignoreDuplicates: true });
  if (error) return { tagged: 0, rows: 0 };

  return { tagged: plan.size, rows: joinRows.length };
}
