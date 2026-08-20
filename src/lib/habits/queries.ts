import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HabitChallenge, HabitCheckIn } from "@/types/database";
import { computeHabitProgress } from "./progress";

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

/** A compact summary of the member's current Clean Streak for the entry cards on
 *  Today and Journey: whether they have any challenge at all, and — if one is
 *  active — its label and progress. All private, own-rows only; the caller wraps
 *  this in a try/catch so a Supabase hiccup just hides the card. */
export type HabitEntrySummary = {
  hasAny: boolean;
  active: {
    id: string;
    habitLabel: string;
    targetDays: number;
    cleanDays: number;
    currentStreak: number;
    percent: number;
    isComplete: boolean;
  } | null;
};

export async function getMyHabitEntrySummary(
  privateClient: PrivateClient,
  userId: string,
  todayIso: string
): Promise<HabitEntrySummary> {
  const challenges = await listMyHabitChallenges(privateClient, userId);
  if (challenges.length === 0) return { hasAny: false, active: null };

  // The most recent active challenge is the one worth surfacing (queries return
  // newest first). Past/abandoned ones still count as "has any" for the nudge.
  const active = challenges.find((c) => c.status === "active") ?? null;
  if (!active) return { hasAny: true, active: null };

  const checkIns = await listCheckInsForChallenge(privateClient, userId, active.id);
  const p = computeHabitProgress(active.target_days, checkIns, todayIso);
  return {
    hasAny: true,
    active: {
      id: active.id,
      habitLabel: active.habit_label,
      targetDays: active.target_days,
      cleanDays: p.cleanDays,
      currentStreak: p.currentStreak,
      percent: p.percent,
      isComplete: p.isComplete,
    },
  };
}
