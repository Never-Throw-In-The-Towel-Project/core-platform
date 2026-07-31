"use server";

import { z } from "zod";
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
  });

  if (!parsed.success) {
    return { status: "error", message: "Please check the form and try again." };
  }

  const supabase = await createClient("private");
  const { noPhoneBeforeBed, hotBathOrShower, gratitude, highlight, dayRating, lookingAhead } = parsed.data;

  const { error } = await supabase.from("night_entries").upsert(
    {
      user_id: session.userId,
      entry_date: todayISODate(new Date(), profile.timezone),
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

  return { status: "success" };
}
