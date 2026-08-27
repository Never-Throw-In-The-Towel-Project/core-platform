import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ContentItem } from "@/types/database";
import { RESUME_MIN_SECONDS, resumeCardMetrics } from "./progressInput";

/**
 * The member's "Pick up where you left off" list for the Library. Joins two
 * schemas by hand because they can't be joined in one PostgREST query:
 *
 *  1. `private.content_progress` — the member's OWN in-progress rows, read
 *     through the session client so RLS (auth.uid() = user_id) is the boundary.
 *     Nothing here reads across members.
 *  2. `public.content_items` — the matching published, channel-visible videos,
 *     read through the normal (public) session client, so an item the member
 *     isn't entitled to (unpublished, or placed on another company) silently
 *     drops off the shelf.
 *
 * Newest-touched first (the order the progress rows come back in), finished
 * watches excluded (`completed = false` plus a belt-and-braces >=95% skip), and
 * videos only — which is all P3b ever records.
 */
export interface ResumeItem {
  item: ContentItem;
  positionSeconds: number;
  durationSeconds: number | null;
  /** Whole-percent watched for the bar (1..99), or null when duration unknown. */
  percent: number | null;
  /** Whole minutes remaining for the label, or null when duration unknown. */
  minutesLeft: number | null;
}

type ProgressRow = {
  content_item_id: string;
  position_seconds: number;
  duration_seconds: number | null;
  updated_at: string;
};

const DEFAULT_LIMIT = 12;

export async function listResumeItems(opts: { limit?: number } = {}): Promise<ResumeItem[]> {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  try {
    // 1) The member's own in-progress rows, newest touched first. The position
    //    floor drops "barely started" noise; completed watches are already out.
    const privateClient = await createClient("private");
    const { data: progressData } = await privateClient
      .from("content_progress")
      .select("content_item_id, position_seconds, duration_seconds, updated_at")
      .eq("completed", false)
      .gte("position_seconds", RESUME_MIN_SECONDS)
      .order("updated_at", { ascending: false })
      .limit(limit);

    const rows = (progressData as ProgressRow[] | null) ?? [];
    if (rows.length === 0) return [];

    // 2) The matching published videos (RLS enforces channel visibility). Only
    //    the ids we have progress for, so this is a small `in (...)` lookup.
    const ids = rows.map((r) => r.content_item_id);
    const publicClient = await createClient();
    const { data: itemData } = await publicClient
      .from("content_items")
      .select("*")
      .in("id", ids)
      .eq("is_published", true)
      .eq("type", "video");

    const byId = new Map((itemData as ContentItem[] | null)?.map((it) => [it.id, it]) ?? []);

    const resume: ResumeItem[] = [];
    for (const row of rows) {
      const item = byId.get(row.content_item_id);
      if (!item) continue; // unpublished / hidden / not a video
      // Prefer the duration captured with the progress; fall back to the item's.
      const duration = row.duration_seconds ?? item.duration_seconds ?? null;
      const metrics = resumeCardMetrics(row.position_seconds, duration);
      if (metrics.done) continue; // effectively finished — off the shelf
      resume.push({
        item,
        positionSeconds: row.position_seconds,
        durationSeconds: duration,
        percent: metrics.percent,
        minutesLeft: metrics.minutesLeft,
      });
    }
    return resume;
  } catch {
    // The table may not exist yet in an environment where the migration hasn't
    // been pushed; degrade to "no resume shelf", never an error.
    return [];
  }
}
