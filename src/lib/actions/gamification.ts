"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySession } from "@/lib/auth/dal";
import { gatherEngagement, badgeStatsFrom } from "@/lib/gamification/todayStats";
import { evaluateBadges, newlyEarnedKeys, badgeLabel } from "@/lib/gamification/badges";
import { getEarnedBadges } from "@/lib/gamification/earnedBadges";

export interface SyncBadgesResult {
  /** Badges earned since last sync -- for a one-time "new badge" moment. */
  newlyEarned: { key: string; label: string }[];
}

/**
 * Persist any badges the member has newly earned, capturing earned_at. Called
 * from the Today screen on load (the universal daily landing page), so a badge
 * is recorded the first time the member visits after crossing its threshold.
 *
 * The engagement is re-derived server-side (never trusted from the client), and
 * user_id comes from the session -- a member can only ever award their own
 * badges. The WRITE runs service-role (earned_badges INSERT is no longer granted
 * to members -- finding C2), so the server-derived eligibility here is the only
 * thing that grants a badge; the member can't self-insert one over PostgREST.
 * earned_badges has no update/delete policy, so a badge can't be revoked.
 * Idempotent: ON CONFLICT DO NOTHING. Best-effort -- any failure just returns
 * "nothing new" rather than disrupting the page.
 */
export async function syncEarnedBadgesAction(): Promise<SyncBadgesResult> {
  try {
    const session = await verifySession();
    const eng = await gatherEngagement(session.userId);
    const badges = evaluateBadges(badgeStatsFrom(eng));

    const privateClient = await createClient("private");
    const persisted = await getEarnedBadges(privateClient, session.userId);
    const newKeys = newlyEarnedKeys(
      badges,
      persisted.map((p) => p.badge_key)
    );
    if (newKeys.length === 0) return { newlyEarned: [] };

    const now = new Date().toISOString();
    // Service-role write: members no longer hold INSERT on earned_badges (C2).
    // user_id is the verified session user and the keys are server-derived
    // above, so this can only ever persist badges this member genuinely earned.
    const admin = createAdminClient("private");
    const { error } = await admin.from("earned_badges").upsert(
      newKeys.map((key) => ({ user_id: session.userId, badge_key: key, earned_at: now })),
      { onConflict: "user_id,badge_key", ignoreDuplicates: true }
    );
    if (error) return { newlyEarned: [] };

    return { newlyEarned: newKeys.map((key) => ({ key, label: badgeLabel(key) })) };
  } catch {
    return { newlyEarned: [] };
  }
}
