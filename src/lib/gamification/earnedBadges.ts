import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// earned_badges lives in the `private` schema, so callers pass a
// createClient("private") instance. RLS scopes rows to the caller; the explicit
// user_id filter keeps the query honest and indexable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any>;

export interface EarnedBadge {
  badge_key: string;
  earned_at: string;
}

/** The caller's own earned badges (key + when), newest first. */
export async function getEarnedBadges(privateClient: AnyClient, userId: string): Promise<EarnedBadge[]> {
  const { data } = await privateClient
    .from("earned_badges")
    .select("badge_key, earned_at")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });
  return (data as EarnedBadge[] | null) ?? [];
}
