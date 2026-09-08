"use server";

import { verifySession, getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { todayISODate } from "@/lib/routines/dates";
import { STAND_FUNDAMENTAL_KEYS, type StandFundamentalKey } from "@/lib/routines/standConfig";

/**
 * The Fundamentals Daily Checklist (Anthony's journal), written from the
 * Today-board rail widget: five yes/no questions, each toggled independently.
 * A partial upsert only touches the one column it sends, so ticking one
 * question never clears another. The entry_date is derived SERVER-SIDE from the
 * member's own timezone -- the client never picks the day it writes to. This is
 * private, own-rows data (RLS: auth.uid() = user_id); no aggregate reads it.
 */
export async function setStandFundamental(
  field: StandFundamentalKey,
  value: boolean
): Promise<{ ok: boolean }> {
  if (!STAND_FUNDAMENTAL_KEYS.includes(field) || typeof value !== "boolean") {
    return { ok: false };
  }

  const session = await verifySession();
  const profile = await getProfile();
  const entryDate = todayISODate(new Date(), profile.timezone);

  // createClient() throws synchronously on a missing/malformed URL/key -- same
  // guard as the other routine actions.
  try {
    const supabase = await createClient("private");
    const { error } = await supabase.from("stand_entries").upsert(
      {
        user_id: session.userId,
        entry_date: entryDate,
        [field]: value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,entry_date" }
    );
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
