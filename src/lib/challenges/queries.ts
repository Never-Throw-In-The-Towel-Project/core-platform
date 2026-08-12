import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Challenge,
  ChallengeDayWithContent,
  ChallengeEnrollment,
  ChallengeWithProgress,
} from "@/types/database";

// Same rationale as lib/content/queries.ts: callers pass whichever client
// instance they already hold. The DEFINITION tables (challenges,
// challenge_days) are in `public`; PARTICIPATION (enrollments, completions) is
// in `private`, so those callers MUST pass a createClient("private") instance
// (see lib/supabase/server.ts on why the schema override is mandatory).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any>;

/** Published challenges (RLS hides drafts from non-admins). Newest first. */
export async function listPublishedChallenges(supabase: AnyClient): Promise<Challenge[]> {
  const { data } = await supabase
    .from("challenges")
    .select("*")
    .eq("is_published", true)
    .order("created_at", { ascending: false });
  return (data as Challenge[] | null) ?? [];
}

/** A single challenge. RLS: a member sees it only when published; an admin always. */
export async function getChallenge(supabase: AnyClient, id: string): Promise<Challenge | null> {
  const { data } = await supabase.from("challenges").select("*").eq("id", id).maybeSingle();
  return (data as Challenge | null) ?? null;
}

/**
 * A challenge's days in order, each joined to its (optional) spine item via the
 * content_item_id FK. The embedded content_items row is itself RLS-filtered, so
 * a day whose content is placed on another channel comes back with content:null
 * for this member -- the day still shows, its media just isn't theirs to see.
 */
export async function getChallengeDays(
  supabase: AnyClient,
  challengeId: string
): Promise<ChallengeDayWithContent[]> {
  const { data } = await supabase
    .from("challenge_days")
    .select("*, content:content_items(*)")
    .eq("challenge_id", challengeId)
    .order("day_index", { ascending: true });
  return (data as ChallengeDayWithContent[] | null) ?? [];
}

/** The caller's enrollment in one challenge, or null. Pass a `private` client. */
export async function getMyEnrollment(
  privateClient: AnyClient,
  userId: string,
  challengeId: string
): Promise<ChallengeEnrollment | null> {
  const { data } = await privateClient
    .from("challenge_enrollments")
    .select("*")
    .eq("user_id", userId)
    .eq("challenge_id", challengeId)
    .maybeSingle();
  return (data as ChallengeEnrollment | null) ?? null;
}

/**
 * The set of challenge_day_ids the caller has completed in one challenge -- what
 * the detail view ticks. Pass a `private` client. RLS already scopes to the
 * caller, but the explicit user_id filter keeps the query honest and indexable.
 */
export async function getMyCompletedDayIds(
  privateClient: AnyClient,
  userId: string,
  challengeId: string
): Promise<Set<string>> {
  const { data } = await privateClient
    .from("challenge_day_completions")
    .select("challenge_day_id")
    .eq("user_id", userId)
    .eq("challenge_id", challengeId);
  return new Set((data ?? []).map((r) => (r as { challenge_day_id: string }).challenge_day_id));
}

/**
 * Published challenges decorated with the caller's own progress (enrolled?,
 * completed-day count) for the list view. Two private reads -- all my
 * enrollments and all my completions -- are tallied in memory rather than
 * per-challenge round trips. Progress is a pure count; there is no notion of
 * "behind" anywhere (see the migration's "no day numbers" note).
 */
export async function listChallengesWithProgress(
  publicClient: AnyClient,
  privateClient: AnyClient,
  userId: string
): Promise<ChallengeWithProgress[]> {
  const challenges = await listPublishedChallenges(publicClient);
  if (challenges.length === 0) return [];

  const [{ data: enrollments }, { data: completions }] = await Promise.all([
    privateClient.from("challenge_enrollments").select("challenge_id").eq("user_id", userId),
    privateClient.from("challenge_day_completions").select("challenge_id").eq("user_id", userId),
  ]);

  const enrolledIn = new Set((enrollments ?? []).map((r) => (r as { challenge_id: string }).challenge_id));
  const completedByChallenge = new Map<string, number>();
  for (const row of completions ?? []) {
    const cid = (row as { challenge_id: string }).challenge_id;
    completedByChallenge.set(cid, (completedByChallenge.get(cid) ?? 0) + 1);
  }

  return challenges.map((c) => ({
    ...c,
    enrolled: enrolledIn.has(c.id),
    completed_days: completedByChallenge.get(c.id) ?? 0,
  }));
}

/**
 * Every challenge including drafts, for the Studio. Safe to call only after
 * requireNtittAdmin() -- a non-admin session would get published rows only (the
 * "authenticated read published challenges" policy), never the drafts.
 */
export async function listAllChallengesForAdmin(supabase: AnyClient): Promise<Challenge[]> {
  const { data } = await supabase.from("challenges").select("*").order("created_at", { ascending: false });
  return (data as Challenge[] | null) ?? [];
}
