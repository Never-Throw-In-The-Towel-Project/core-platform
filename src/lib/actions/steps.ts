"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { todayISODate } from "@/lib/routines/dates";
import { type RoutineActionState } from "./routineState";

const StepsSchema = z.object({
  // Optional + an empty-string->undefined guard at the call site (see below):
  // z.coerce.number("") is 0, which would pass .min(0) and silently overwrite a
  // real step count with a zero on the shared (user_id, entry_date) row -- the
  // same row the night routine writes (finding E3). An explicit "0" is still a
  // valid entry; only a *blank* submit is rejected.
  steps: z.coerce.number().int().min(0).max(200000).optional(),
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

  // Empty string -> undefined BEFORE zod coercion, so a blank "Log" tap never
  // becomes a 0 (finding E3). Same guard the night routine uses for its steps
  // field (lib/actions/night.ts).
  const rawSteps = formData.get("steps");
  const parsed = StepsSchema.safeParse({
    steps: (rawSteps as string | null)?.trim() ? rawSteps : undefined,
  });
  if (!parsed.success || parsed.data.steps === undefined) {
    return { status: "error", message: "Enter your steps as a whole number." };
  }
  const steps = parsed.data.steps;

  // Wrapped in try/catch: createClient() throws synchronously if the URL/key
  // are missing or malformed -- same gap already closed elsewhere.
  try {
    const supabase = await createClient("private");
    const { error } = await supabase.from("step_entries").upsert(
      {
        user_id: session.userId,
        entry_date: todayISODate(new Date(), profile.timezone),
        steps,
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
