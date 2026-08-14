import { NextResponse } from "next/server";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

// Right of access + portability (UK GDPR Arts. 15/20): a member downloads a
// machine-readable copy of their own personal data. Everything is read under the
// member's OWN RLS-scoped session -- private tables are own-rows-only, so they
// return only this member's rows; the public community tables are filtered to
// their own user_id explicitly (RLS there lets a member read others' too).
export const dynamic = "force-dynamic";

type AnyClient = Awaited<ReturnType<typeof createClient>>;

// Read a table defensively: a wrong/absent table name yields [] rather than
// failing the whole export.
async function rows(client: AnyClient, table: string, ownUserId?: string): Promise<unknown[]> {
  try {
    let q = client.from(table).select("*");
    if (ownUserId) q = q.eq("user_id", ownUserId);
    const { data } = await q;
    return data ?? [];
  } catch {
    return [];
  }
}

export async function GET() {
  await verifySession();
  const profile = await getProfile();

  const pub = await createClient();
  const priv = await createClient("private");

  const [
    morningEntries,
    nightEntries,
    themedCheckins,
    weeklyReviews,
    periodicReviews,
    stepEntries,
    earnedBadges,
    challengeEnrollments,
    challengeDayCompletions,
    stepChallengeOptins,
    communityPosts,
    communityComments,
  ] = await Promise.all([
    rows(priv, "morning_entries"),
    rows(priv, "night_entries"),
    rows(priv, "themed_checkins"),
    rows(priv, "weekly_reviews"),
    rows(priv, "periodic_reviews"),
    rows(priv, "step_entries"),
    rows(priv, "earned_badges"),
    rows(priv, "challenge_enrollments"),
    rows(priv, "challenge_day_completions"),
    rows(priv, "company_step_challenge_optins"),
    rows(pub, "community_posts", profile.id),
    rows(pub, "community_comments", profile.id),
  ]);

  const payload = {
    export: {
      product: "Never Throw In The Towel",
      generatedAt: new Date().toISOString(),
      note: "Your personal data, as held by NTITT. Private entries here are visible only to you.",
    },
    profile,
    morningEntries,
    nightEntries,
    themedCheckins,
    weeklyReviews,
    periodicReviews,
    stepEntries,
    earnedBadges,
    challengeEnrollments,
    challengeDayCompletions,
    stepChallengeOptins,
    communityPosts,
    communityComments,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ntitt-my-data.json"',
      "Cache-Control": "no-store",
    },
  });
}
