import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentStage, ContentStageWithCount } from "@/types/database";
import { STAGE_KEYS, STAGE_META } from "@/lib/content/stageConfig";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers pass whichever client they hold
type AnyClient = SupabaseClient<any, any>;

/**
 * The three "Where you are" stages decorated with how many published,
 * viewer-visible items carry each — the Library's stage filter pills. Counts
 * come from the assignment join INNER-joined to content_items, so content_items'
 * own RLS (published + channel-visible) filters them: a member never counts
 * drafts or another company's content. Text items are excluded, matching the
 * grid. Always returns all three stages in display order (STAGE_KEYS), 0 count
 * included, so the caller decides whether to show empty ones.
 */
export async function listStagesWithCounts(supabase: AnyClient): Promise<ContentStageWithCount[]> {
  const { data } = await supabase
    .from("content_item_stages")
    .select("stage, content_items!inner(is_published, type)")
    .eq("content_items.is_published", true)
    .neq("content_items.type", "text");

  const counts = new Map<ContentStage, number>();
  for (const row of (data as { stage: ContentStage }[] | null) ?? []) {
    counts.set(row.stage, (counts.get(row.stage) ?? 0) + 1);
  }

  return STAGE_KEYS.map((stage) => ({ stage, label: STAGE_META[stage].label, count: counts.get(stage) ?? 0 }));
}
