import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentTopic } from "@/types/database";

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
