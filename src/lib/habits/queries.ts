import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HabitChallenge, HabitCheckIn } from "@/types/database";

// The client here MUST be createClient("private") -- these tables live in the
// `private` schema and 404 through the default public client. RLS already scopes
// every row to the caller (auth.uid() = user_id); the explicit .eq("user_id") is
// belt-and-suspenders + index use, matching the other private-data queries.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrivateClient = SupabaseClient<any, any>;

/** The member's own habit challenges, newest first. */
export async function listMyHabitChallenges(
  privateClient: PrivateClient,
  userId: string
): Promise<HabitChallenge[]> {
  const { data } = await privateClient
    .from("habit_challenges")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data as HabitChallenge[] | null) ?? [];
}

/** A single own challenge (null if it isn't the caller's / doesn't exist). */
export async function getMyHabitChallenge(
  privateClient: PrivateClient,
  userId: string,
  id: string
): Promise<HabitChallenge | null> {
  const { data } = await privateClient
    .from("habit_challenges")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  return (data as HabitChallenge | null) ?? null;
}

/** All of the caller's check-ins for one challenge (for the calendar + progress). */
export async function listCheckInsForChallenge(
  privateClient: PrivateClient,
  userId: string,
  challengeId: string
): Promise<HabitCheckIn[]> {
  const { data } = await privateClient
    .from("habit_check_ins")
    .select("*")
    .eq("user_id", userId)
    .eq("habit_challenge_id", challengeId)
    .order("check_in_date", { ascending: true });
  return (data as HabitCheckIn[] | null) ?? [];
}

/** Every check-in across ALL of the caller's challenges, for list/summary views
 *  that render each challenge's progress without N round-trips. */
export async function listAllMyCheckIns(
  privateClient: PrivateClient,
  userId: string
): Promise<HabitCheckIn[]> {
  const { data } = await privateClient
    .from("habit_check_ins")
    .select("*")
    .eq("user_id", userId)
    .order("check_in_date", { ascending: true });
  return (data as HabitCheckIn[] | null) ?? [];
}
