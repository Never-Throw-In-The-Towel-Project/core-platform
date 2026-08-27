import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Read the caller's own resume state for one content item, for the watch page to
 * seek back to. Private, own-rows data (migration 20260903000000): the query runs
 * through the session client against the `private` schema, so RLS
 * (auth.uid() = user_id) means it can only ever return THIS member's row — no
 * user_id filter is needed or wanted here. Returns null when there's no saved
 * progress (never watched, or a transient failure — either way, start from the
 * top). The (app) layout already guarantees a session upstream.
 */
export interface ContentResumeState {
  positionSeconds: number;
  durationSeconds: number | null;
  completed: boolean;
}

export async function getContentResumeState(contentItemId: string): Promise<ContentResumeState | null> {
  try {
    const supabase = await createClient("private");
    const { data } = await supabase
      .from("content_progress")
      .select("position_seconds, duration_seconds, completed")
      .eq("content_item_id", contentItemId)
      .maybeSingle();

    if (!data) return null;
    return {
      positionSeconds: typeof data.position_seconds === "number" ? data.position_seconds : 0,
      durationSeconds: typeof data.duration_seconds === "number" ? data.duration_seconds : null,
      completed: data.completed === true,
    };
  } catch {
    return null;
  }
}
