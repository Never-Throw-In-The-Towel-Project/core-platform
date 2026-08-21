"use server";

import { verifySession, getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { todayISODate } from "@/lib/routines/dates";
import {
  STAND_FUNDAMENTAL_KEYS,
  STAND_REFLECTION_KEYS,
  type StandFundamentalKey,
  type StandReflectionKey,
} from "@/lib/routines/standConfig";

/**
 * The STAND daily fundamentals checklist (Anthony's journal), written from the
 * Today-board widget. Two independent writes against the same day's row
 * (unique user_id, entry_date):
 *   - setStandFundamental: toggle one of the four discipline ticks.
 *   - saveStandReflections: save the five reflective prompts.
 * A partial upsert only touches the columns it sends, so ticking never clears a
 * reflection and vice versa. The entry_date is derived SERVER-SIDE from the
 * member's own timezone -- the client never picks the day it writes to. This is
 * private, own-rows data (RLS: auth.uid() = user_id); no aggregate reads it.
 */
const MAX_REFLECTION_LENGTH = 4000;

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

export async function saveStandReflections(
  values: Partial<Record<StandReflectionKey, string>>
): Promise<{ ok: boolean }> {
  const session = await verifySession();
  const profile = await getProfile();
  const entryDate = todayISODate(new Date(), profile.timezone);

  // Only the five known reflection columns are ever written; anything else on
  // the incoming object is ignored. Empty/blank becomes null so a cleared box
  // doesn't persist whitespace.
  const reflections: Record<string, string | null> = {};
  for (const key of STAND_REFLECTION_KEYS) {
    const raw = values[key];
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim().slice(0, MAX_REFLECTION_LENGTH);
    reflections[key] = trimmed.length > 0 ? trimmed : null;
  }

  try {
    const supabase = await createClient("private");
    const { error } = await supabase.from("stand_entries").upsert(
      {
        user_id: session.userId,
        entry_date: entryDate,
        ...reflections,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,entry_date" }
    );
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
