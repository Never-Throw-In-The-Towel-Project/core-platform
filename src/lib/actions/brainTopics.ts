"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { tagContentTopics } from "@/lib/content/topicTagging";

// One AI call handles a page of items; 20 keeps each call small and the loop
// responsive. The client drains the library by advancing `offset` per run.
const PAGE = 20;

export type TopicBackfillResult =
  | { status: "success"; scanned: number; tagged: number; total: number; nextOffset: number; done: boolean }
  | { status: "error"; message: string };

const InputSchema = z.object({ offset: z.number().int().min(0).max(1_000_000).optional() });

/**
 * One page of the topic backfill: scan the next `PAGE` published items
 * (newest-first), AI-tag the ones that carry NO topics yet (items already tagged
 * — by the sync auto-tag or an earlier run — are skipped, never re-classified),
 * and report progress so a Brain button can loop to `done`. Offset paging means
 * the whole library is covered in ceil(total/PAGE) runs regardless of how many
 * items a page happens to tag.
 */
export async function backfillTopicsAction(input: { offset?: number }): Promise<TopicBackfillResult> {
  await requireNtittAdmin();

  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Bad request." };
  const offset = parsed.data.offset ?? 0;

  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("content_items")
    .select("id, title, summary, tags, content_item_topics(topic_id)", { count: "exact" })
    .eq("is_published", true)
    .neq("type", "text")
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE - 1);

  if (error) return { status: "error", message: "Couldn’t read the library. Please try again." };

  type Row = {
    id: string;
    title: string;
    summary: string | null;
    tags: string[] | null;
    content_item_topics: { topic_id: string }[] | null;
  };
  const rows = (data as Row[] | null) ?? [];
  const untagged = rows.filter((r) => (r.content_item_topics?.length ?? 0) === 0);

  let tagged = 0;
  if (untagged.length > 0) {
    const outcome = await tagContentTopics(
      supabase,
      untagged.map((r) => ({ id: r.id, title: r.title, summary: r.summary, tags: r.tags ?? [] }))
    );
    tagged = outcome.tagged;
  }

  const total = count ?? 0;
  const nextOffset = offset + rows.length;
  const done = rows.length === 0 || nextOffset >= total;
  if (tagged > 0) revalidatePath("/content");

  return { status: "success", scanned: rows.length, tagged, total, nextOffset, done };
}
