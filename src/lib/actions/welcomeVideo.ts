"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifySession } from "@/lib/auth/dal";

/**
 * Mark the first-run welcome video as seen, so the modal on /home never pops
 * again. Written through the member's OWN session client (profiles has a
 * column-level UPDATE grant on welcome_video_seen_at — 20261112000000); the RLS
 * row policy (auth.uid() = id) scopes it to their own row. The `.is(...null)`
 * guard makes it idempotent and preserves the first-seen timestamp if somehow
 * called twice. Best-effort: a failure just means the modal may show once more.
 */
export async function markWelcomeVideoSeen(): Promise<{ ok: boolean }> {
  const session = await verifySession();
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ welcome_video_seen_at: new Date().toISOString() })
      .eq("id", session.userId)
      .is("welcome_video_seen_at", null);
    if (error) return { ok: false };
  } catch {
    return { ok: false };
  }
  revalidatePath("/home");
  return { ok: true };
}
