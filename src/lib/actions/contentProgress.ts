"use server";

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
 * touch their OWN row — the user_id is taken from the authenticated session, never
 * from the client. Nothing aggregates over this table; what a member watches is
 * theirs.
 *
 * Auth deliberately does NOT go through the DAL's verifySession(): that redirects
 * to /login when there's no session, which is right for a user-clicked save but
 * wrong here — this fires automatically as a video plays, and a background ping
 * must never navigate the member away. Instead we resolve the user with
 * getUser() (which still re-validates the JWT, so the RLS boundary is unchanged)
 * and simply no-op if the session has lapsed.
 */
export async function recordContentProgress(input: RawProgressInput): Promise<{ ok: boolean }> {
  const normalized = normalizeProgressInput(input);
  if (!normalized) return { ok: false };

  // createClient() throws synchronously on a missing/malformed URL/key, and
  // getUser() can throw on an unrecognised auth error -- both are treated as
  // "no save", same best-effort stance as the routine actions: a member just
  // watching a video never sees a progress ping fail.
  try {
    const supabase = await createClient("private");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false };

    const { error } = await supabase.from("content_progress").upsert(
      {
        user_id: user.id,
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
