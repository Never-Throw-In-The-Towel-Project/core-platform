import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getIsoWeekNumber, resolveBankPosition } from "./dates";

/**
 * The Thursday quote of the week for `now` -- a week-journey (see
 * docs/ARCHITECTURE.md): keyed by real ISO calendar week modulo however many
 * quotes are seeded, so every user sees the same quote in the same real week
 * regardless of when they personally started. Deliberately keyed off UTC, not
 * the caller's own timezone -- this is shared content selection, and using each
 * user's own zone could flip different users onto different bank positions on
 * the same calendar day near a week boundary. Returns null if no quotes are
 * seeded yet (content ops hasn't run, not an error).
 *
 * (Workout Wednesday used to resolve its workout the same way, from a bespoke
 * workout_weeks bank; that bank is retired -- Workout Wednesday now draws Home /
 * Gym videos from the library via listWorkoutVideos in lib/content/queries.ts.)
 */
export async function getDailyQuote(now: Date = new Date()) {
  // Wrapped in try/catch: createClient() throws synchronously if the URL/key
  // are missing or malformed. Returning null is the same "not seeded yet"
  // fallback as a genuinely empty bank, not a distinct case the caller handles.
  try {
    const supabase = await createClient();

    const { count } = await supabase
      .from("daily_quotes")
      .select("id", { count: "exact", head: true });

    if (!count) return null;

    const bankPosition = resolveBankPosition(getIsoWeekNumber(now, "UTC"), count);

    const { data } = await supabase
      .from("daily_quotes")
      .select("quote_text, author")
      .eq("bank_position", bankPosition)
      .maybeSingle();

    return data;
  } catch {
    return null;
  }
}
