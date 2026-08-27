"use server";

import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { normalizeProgressInput, type RawProgressInput } from "@/lib/content/progressInput";

/**
 * Record a member's video watch position — the private, own-rows data behind the
 * Library's "Pick up where you left off" (migration 20260903000000). Called from
 * the watch-page player (components/content/VimeoWatch.tsx) as playback moves on,
 * pauses, or ends. One row per member per item (unique user_id, content_item_id),
 * upserted each time, so the newest report wins.
 *
 * Privacy: this lives in the `private` schema and is written via the session
 * client, so RLS (auth.uid() = user_id) is what guarantees a member can only ever
 * touch their OWN row — the user_id is taken from the verified session, never from
 * the client. Nothing aggregates over this table; what a member watches is theirs.
 */
export async function recordContentProgress(input: RawProgressInput): Promise<{ ok: boolean }> {
  const normalized = normalizeProgressInput(input);
  if (!normalized) return { ok: false };

  // verifySession() re-validates the JWT (see the DAL) and is the source of the
  // user_id we write — a client can't claim to be someone else.
  const session = await verifySession();

  // createClient() throws synchronously on a missing/malformed URL/key -- same
  // best-effort guard as the routine actions; a failed progress ping must never
  // surface an error to a member who's just watching a video.
  try {
    const supabase = await createClient("private");
    const { error } = await supabase.from("content_progress").upsert(
      {
        user_id: session.userId,
        content_item_id: normalized.contentItemId,
        position_seconds: normalized.positionSeconds,
        duration_seconds: normalized.durationSeconds,
        completed: normalized.completed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,content_item_id" }
    );
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
