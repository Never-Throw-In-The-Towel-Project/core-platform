"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { todayISODate } from "@/lib/routines/dates";
import { type RoutineActionState } from "./routineState";

const StepsSchema = z.object({
  steps: z.coerce.number().int().min(0).max(200000),
});

/**
 * Log (or update) the member's own step count for TODAY. The date is computed
 * server-side from the caller's timezone, never trusted from the client, and
 * user_id comes from the session -- a member can only ever write their own
 * private row (RLS enforces the same). Upsert on (user_id, entry_date) so
 * re-logging corrects the day rather than duplicating it.
 */
export async function logStepsAction(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();
  const profile = await getProfile();

  const parsed = StepsSchema.safeParse({ steps: formData.get("steps") });
  if (!parsed.success) {
    return { status: "error", message: "Enter your steps as a whole number." };
  }

  // Wrapped in try/catch: createClient() throws synchronously if the URL/key
  // are missing or malformed -- same gap already closed elsewhere.
  try {
    const supabase = await createClient("private");
    const { error } = await supabase.from("step_entries").upsert(
      {
        user_id: session.userId,
        entry_date: todayISODate(new Date(), profile.timezone),
        steps: parsed.data.steps,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,entry_date" }
    );

    if (error) {
      return { status: "error", message: "Something went wrong saving that. Please try again." };
    }
  } catch {
    return { status: "error", message: "Something went wrong saving that. Please try again." };
  }

  revalidatePath("/journey");
  return { status: "success" };
}
