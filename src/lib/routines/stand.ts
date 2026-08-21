import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StandEntry } from "@/types/database";

// The client here MUST be createClient("private") -- stand_entries lives in the
// `private` schema and 404s through the default public client. RLS already
// scopes every row to the caller (auth.uid() = user_id); the explicit
// .eq("user_id") is belt-and-suspenders + index use, matching the other
// private-data queries.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrivateClient = SupabaseClient<any, any>;

/** The caller's STAND entry for a given local day, or null if none yet. */
export async function getMyStandEntry(
  privateClient: PrivateClient,
  userId: string,
  entryDate: string
): Promise<StandEntry | null> {
  const { data } = await privateClient
    .from("stand_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("entry_date", entryDate)
    .maybeSingle();
  return (data as StandEntry | null) ?? null;
}
