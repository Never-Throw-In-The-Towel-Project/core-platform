import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StepEntry } from "@/types/database";

// step_entries lives in the `private` schema, so every caller MUST pass a
// createClient("private") instance (see lib/supabase/server.ts). RLS already
// scopes rows to the caller; the explicit user_id filter keeps the query honest
// and indexable, matching the rest of the private reads.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any>;

/** The caller's own step entries on or after `sinceDate` (ISO), oldest first. */
export async function getRecentSteps(
  privateClient: AnyClient,
  userId: string,
  sinceDate: string
): Promise<StepEntry[]> {
  const { data } = await privateClient
    .from("step_entries")
    .select("*")
    .eq("user_id", userId)
    .gte("entry_date", sinceDate)
    .order("entry_date", { ascending: true });
  return (data as StepEntry[] | null) ?? [];
}
