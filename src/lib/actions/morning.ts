"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { todayISODate } from "@/lib/routines/dates";
import { type RoutineActionState } from "./routineState";

const MorningEntrySchema = z.object({
  sleepScore: z.coerce.number().int().min(1).max(10),
  morningWalk: z.boolean(),
  breathwork: z.boolean(),
  coldDip: z.boolean(),
  powerList: z.string().max(4000).optional(),
});

export async function submitMorningEntry(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();
  const profile = await getProfile();

  const parsed = MorningEntrySchema.safeParse({
    sleepScore: formData.get("sleepScore"),
    morningWalk: formData.get("morningWalk") === "true",
    breathwork: formData.get("breathwork") === "true",
    coldDip: formData.get("coldDip") === "true",
    powerList: formData.get("powerList") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: "Please check the form and try again." };
  }

  const { sleepScore, morningWalk, breathwork, coldDip, powerList } = parsed.data;

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  try {
    const supabase = await createClient("private");
    const { error } = await supabase.from("morning_entries").upsert(
      {
        user_id: session.userId,
        entry_date: todayISODate(new Date(), profile.timezone),
        sleep_score: sleepScore,
        morning_walk: morningWalk,
        breathwork,
        cold_dip: coldDip,
        power_list: powerList ?? null,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,entry_date" }
    );

    if (error) {
      return { status: "error", message: "Something went wrong saving this. Please try again." };
    }
  } catch {
    return { status: "error", message: "Something went wrong saving this. Please try again." };
  }

  return { status: "success" };
}
