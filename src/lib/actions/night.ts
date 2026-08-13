"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { todayISODate } from "@/lib/routines/dates";
import { type RoutineActionState } from "./routineState";

const NightEntrySchema = z.object({
  noPhoneBeforeBed: z.boolean(),
  hotBathOrShower: z.boolean(),
  gratitude: z.string().max(2000).optional(),
  highlight: z.string().max(2000).optional(),
  dayRating: z.coerce.number().int().min(1).max(10),
  lookingAhead: z.string().max(2000).optional(),
  // Steps are OPTIONAL and stored separately (see below). Left blank, they are
  // never written, so completing the routine never overwrites a value logged
  // elsewhere (e.g. the Journey card) with a 0. Never mandatory (brief §1).
  steps: z.coerce.number().int().min(0).max(200000).optional(),
});

export async function submitNightEntry(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();
  const profile = await getProfile();

  const parsed = NightEntrySchema.safeParse({
    noPhoneBeforeBed: formData.get("noPhoneBeforeBed") === "true",
    hotBathOrShower: formData.get("hotBathOrShower") === "true",
    gratitude: formData.get("gratitude") || undefined,
    highlight: formData.get("highlight") || undefined,
    dayRating: formData.get("dayRating"),
    lookingAhead: formData.get("lookingAhead") || undefined,
    // Empty string -> undefined BEFORE zod coercion (z.coerce.number("") is 0,
    // which would silently overwrite a real step count with a zero).
    steps: (formData.get("steps") as string | null)?.trim() ? formData.get("steps") : undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: "Please check the form and try again." };
  }

  const { noPhoneBeforeBed, hotBathOrShower, gratitude, highlight, dayRating, lookingAhead, steps } = parsed.data;
  const entryDate = todayISODate(new Date(), profile.timezone);

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  try {
    const supabase = await createClient("private");
    const { error } = await supabase.from("night_entries").upsert(
      {
        user_id: session.userId,
        entry_date: entryDate,
        no_phone_before_bed: noPhoneBeforeBed,
        hot_bath_or_shower: hotBathOrShower,
        gratitude: gratitude ?? null,
        highlight: highlight ?? null,
        day_rating: dayRating,
        looking_ahead: lookingAhead ?? null,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,entry_date" }
    );

    if (error) {
      return { status: "error", message: "Something went wrong saving this. Please try again." };
    }

    // Steps live in their own private, never-reportable table (`step_entries`,
    // like `sleep_score`/`day_rating`). Best-effort and OPTIONAL: only written
    // when the member actually entered a value, and a failure here never blocks
    // completing the routine -- steps are never mandatory (brief §1). Re-logging
    // corrects the day via the same (user_id, entry_date) upsert used elsewhere.
    if (steps !== undefined) {
      const { error: stepsError } = await supabase.from("step_entries").upsert(
        {
          user_id: session.userId,
          entry_date: entryDate,
          steps,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,entry_date" }
      );
      if (!stepsError) revalidatePath("/journey");
    }
  } catch {
    return { status: "error", message: "Something went wrong saving this. Please try again." };
  }

  return { status: "success" };
}
