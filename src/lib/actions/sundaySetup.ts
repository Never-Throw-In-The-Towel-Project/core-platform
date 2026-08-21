"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { getNextMonday, weekdayNameOrWeekend } from "@/lib/routines/dates";
import { type RoutineActionState } from "./routineState";

const SundaySetupSchema = z.object({
  prepNotes: z.string().max(2000).optional(),
  intention: z.string().max(2000).optional(),
});

export async function submitSundaySetup(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();
  const profile = await getProfile();

  // Server derives "today" itself rather than trusting the client, same
  // pattern as the themed check-in lock -- Set Up Sunday only writes on an
  // actual Sunday.
  if (weekdayNameOrWeekend(new Date(), profile.timezone) !== "sunday") {
    return { status: "error", message: "Set Up Sunday is only available on Sundays." };
  }

  const parsed = SundaySetupSchema.safeParse({
    prepNotes: formData.get("prepNotes") || undefined,
    intention: formData.get("intention") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: "Please check the form and try again." };
  }

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  try {
    const supabase = await createClient("private");

    const { error } = await supabase.from("sunday_setups").upsert(
      {
        user_id: session.userId,
        week_start_date: getNextMonday(new Date(), profile.timezone),
        prep_notes: parsed.data.prepNotes ?? null,
        intention: parsed.data.intention ?? null,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,week_start_date" }
    );

    if (error) {
      return { status: "error", message: "Something went wrong saving this. Please try again." };
    }
  } catch {
    return { status: "error", message: "Something went wrong saving this. Please try again." };
  }

  return { status: "success" };
}
