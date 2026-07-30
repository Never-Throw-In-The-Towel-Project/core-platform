"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { verifySession } from "@/lib/auth/dal";
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

  // Server derives "today" itself rather than trusting the client, same
  // pattern as the themed check-in lock -- Sunday Setup only writes on an
  // actual Sunday.
  if (weekdayNameOrWeekend(new Date()) !== "sunday") {
    return { status: "error", message: "Sunday Setup is only available on Sundays." };
  }

  const parsed = SundaySetupSchema.safeParse({
    prepNotes: formData.get("prepNotes") || undefined,
    intention: formData.get("intention") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: "Please check the form and try again." };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("sunday_setups").upsert(
    {
      user_id: session.userId,
      week_start_date: getNextMonday(),
      prep_notes: parsed.data.prepNotes ?? null,
      intention: parsed.data.intention ?? null,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,week_start_date" }
  );

  if (error) {
    return { status: "error", message: "Something went wrong saving this. Please try again." };
  }

  return { status: "success" };
}
