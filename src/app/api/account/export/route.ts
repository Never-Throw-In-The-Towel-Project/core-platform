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

// Read a table defensively: a query error yields [] but is recorded in
// `warnings`, so a partial export is signalled to the member (in the payload)
// rather than silently handed over as a "complete" copy.
async function rows(
  client: AnyClient,
  table: string,
  warnings: string[],
  ownUserId?: string
): Promise<unknown[]> {
  try {
    let q = client.from(table).select("*");
    if (ownUserId) q = q.eq("user_id", ownUserId);
    const { data, error } = await q;
    if (error) {
      warnings.push(`${table}: ${error.message}`);
      return [];
    }
    return data ?? [];
  } catch (e) {
    warnings.push(`${table}: ${e instanceof Error ? e.message : "read failed"}`);
    return [];
  }
}

export async function GET() {
  await verifySession();
  const profile = await getProfile();

  const pub = await createClient();
  const priv = await createClient("private");
  const warnings: string[] = [];

  const [
    morningEntries,
    nightEntries,
    themedCheckins,
    sundaySetups,
    weeklyReviews,
    periodicReviews,
    stepEntries,
    earnedBadges,
    challengeEnrollments,
    challengeDayCompletions,
    stepChallengeOptins,
    supportRequests,
    communityPosts,
    communityComments,
  ] = await Promise.all([
    rows(priv, "morning_entries", warnings),
    rows(priv, "night_entries", warnings),
    rows(priv, "themed_checkins", warnings),
    rows(priv, "sunday_setups", warnings),
    rows(priv, "weekly_reviews", warnings),
    rows(priv, "periodic_reviews", warnings),
    rows(priv, "step_entries", warnings),
    rows(priv, "earned_badges", warnings),
    rows(priv, "challenge_enrollments", warnings),
    rows(priv, "challenge_day_completions", warnings),
    rows(priv, "company_step_challenge_optins", warnings),
    rows(priv, "support_requests", warnings),
    rows(pub, "community_posts", warnings, profile.id),
    rows(pub, "community_comments", warnings, profile.id),
  ]);

  const payload = {
    export: {
      product: "Never Throw In The Towel",
      generatedAt: new Date().toISOString(),
      note: "Your personal data, as held by NTITT. Private entries here are visible only to you.",
      // Only present when one or more sections failed to read -- so a partial
      // export is never mistaken for a complete one.
      ...(warnings.length > 0 ? { incompleteSections: warnings } : {}),
    },
    profile,
    morningEntries,
    nightEntries,
    themedCheckins,
    sundaySetups,
    weeklyReviews,
    periodicReviews,
    stepEntries,
    earnedBadges,
    challengeEnrollments,
    challengeDayCompletions,
    stepChallengeOptins,
    supportRequests,
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
