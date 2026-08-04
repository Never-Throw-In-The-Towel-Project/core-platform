"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifySession } from "@/lib/auth/dal";
import { DisplayNameSchema } from "./settings";
import { type RoutineActionState } from "./routineState";

const TimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Please choose a valid time.");

/**
 * Last step of onboarding (design reference frame 1j: "notification times
 * and display name in one ruled sheet") -- a single write for the whole
 * sheet, ending with onboarding_completed so the (app) layout's gate opens.
 * There's no separate "step 4" screen: the reference's own step-3 button
 * ("Finish setup") links straight to the Today screen, so landing there
 * *is* the fourth step.
 */
export async function finishOnboarding(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();

  const parsed = z
    .object({
      displayName: DisplayNameSchema,
      morningTime: TimeSchema,
      nightTime: TimeSchema,
      sundayTime: TimeSchema,
    })
    .safeParse({
      displayName: formData.get("displayName"),
      morningTime: formData.get("morningTime"),
      nightTime: formData.get("nightTime"),
      sundayTime: formData.get("sundayTime"),
    });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      morning_notification_time: parsed.data.morningTime,
      night_notification_time: parsed.data.nightTime,
      sunday_notification_time: parsed.data.sundayTime,
      onboarding_completed: true,
    })
    .eq("id", session.userId);

  if (error) {
    return { status: "error", message: "Something went wrong saving this. Please try again." };
  }

  revalidatePath("/home");
  revalidatePath("/settings");
  revalidatePath("/community");
  revalidatePath("/community/wins");
  revalidatePath("/community/company");
  return { status: "success" };
}
