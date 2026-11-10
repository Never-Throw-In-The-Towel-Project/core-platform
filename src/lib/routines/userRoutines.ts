import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRoutine } from "@/types/database";

// These tables live in the `private` schema, so the client MUST be
// createClient("private") -- they 404 through the default public client. RLS
// scopes every row to the caller (auth.uid() = user_id); the explicit
// .eq("user_id") is belt-and-suspenders + index use, matching the other
// private-data queries (lib/habits/queries.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrivateClient = SupabaseClient<any, any>;

/** The serialisable shape the Today board's "My Routines" card renders. */
export type TodayRoutine = {
  id: string;
  label: string;
  /** "HH:MM" local time hint, or null. */
  time: string | null;
  done: boolean;
};

/**
 * The member's active routines that run today (by ISO weekday), each with
 * today's tick state. Two reads: the matching routines, then today's
 * completions for just those routines. Private, own-rows only.
 */
export async function getTodaysRoutines(
  privateClient: PrivateClient,
  userId: string,
  isoWeekday: number,
  todayIso: string
): Promise<TodayRoutine[]> {
  const { data: routines } = await privateClient
    .from("user_routines")
    .select("id, label, time_of_day")
    .eq("user_id", userId)
    .eq("active", true)
    .contains("weekdays", [isoWeekday])
    .order("time_of_day", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const rows = (routines as { id: string; label: string; time_of_day: string | null }[] | null) ?? [];
  if (rows.length === 0) return [];

  const { data: completions } = await privateClient
    .from("user_routine_completions")
    .select("routine_id")
    .eq("user_id", userId)
    .eq("completion_date", todayIso)
    .in(
      "routine_id",
      rows.map((r) => r.id)
    );

  const done = new Set((completions as { routine_id: string }[] | null)?.map((c) => c.routine_id) ?? []);

  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    time: r.time_of_day ? r.time_of_day.slice(0, 5) : null,
    done: done.has(r.id),
  }));
}

/** All of the member's routines (active first, then retired), for the manage page. */
export async function listMyRoutines(privateClient: PrivateClient, userId: string): Promise<UserRoutine[]> {
  const { data } = await privateClient
    .from("user_routines")
    .select("*")
    .eq("user_id", userId)
    .order("active", { ascending: false })
    .order("time_of_day", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  return (data as UserRoutine[] | null) ?? [];
}
