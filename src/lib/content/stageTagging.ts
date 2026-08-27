import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { categorizeStages, type StageInputItem } from "@/lib/ai/categorizeStages";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- session OR service-role client
type AnyClient = SupabaseClient<any, any>;

export type StageTaggingOutcome = { tagged: number; rows: number };

/**
 * AI-tag a batch of content items with journey stages and persist the
 * assignments — the one orchestration reused by BOTH the Vimeo-sync auto-tag
 * (new uploads) and the Brain backfill (existing library). Simpler than the
 * topic version: stages are a fixed set, so the classifier's keys ARE the stored
 * values (content_item_stages.stage) — no taxonomy id lookup. The composite PK +
 * ignoreDuplicates make it idempotent, so a re-run never double-inserts.
 *
 * Best-effort by contract: callers wrap it so a tagging hiccup never fails the
 * import it rode in on. Returns how many items got ≥1 stage and how many join
 * rows were written.
 */
export async function tagContentStages(supabase: AnyClient, items: StageInputItem[]): Promise<StageTaggingOutcome> {
  if (items.length === 0) return { tagged: 0, rows: 0 };

  const plan = await categorizeStages(items);
  if (plan.size === 0) return { tagged: 0, rows: 0 };

  const joinRows: { content_item_id: string; stage: string }[] = [];
  for (const [contentItemId, stages] of plan) {
    for (const stage of stages) joinRows.push({ content_item_id: contentItemId, stage });
  }
  if (joinRows.length === 0) return { tagged: 0, rows: 0 };

  const { error } = await supabase
    .from("content_item_stages")
    .upsert(joinRows, { onConflict: "content_item_id,stage", ignoreDuplicates: true });
  if (error) return { tagged: 0, rows: 0 };

  return { tagged: plan.size, rows: joinRows.length };
}
