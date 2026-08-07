"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifySession } from "@/lib/auth/dal";
import { type RoutineActionState } from "./routineState";
import { TimeSchema, DisplayNameSchema } from "./schemas";

/**
 * Validates against the runtime's actual IANA tzdata (Intl.DateTimeFormat
 * throws on an unrecognized zone) rather than a hardcoded enum -- the set of
 * valid zone names isn't something worth keeping in sync by hand, and this
 * is the same check the browser's own <select> of Intl.supportedValuesOf
 * options can only ever produce valid values from anyway.
 */
const TimezoneSchema = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "Not a recognized timezone.");

export async function updateTimezone(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();

  const parsed = TimezoneSchema.safeParse(formData.get("timezone"));
  if (!parsed.success) {
    return { status: "error", message: "Please choose a valid timezone." };
  }

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ timezone: parsed.data })
      .eq("id", session.userId);

    if (error) {
      return { status: "error", message: "Something went wrong saving this. Please try again." };
    }
  } catch {
    return { status: "error", message: "Something went wrong saving this. Please try again." };
  }

  revalidatePath("/settings");
  revalidatePath("/home");
  return { status: "success" };
}

/**
 * Onboarding writes these three columns once (lib/actions/onboarding.ts);
 * this is the only way to change them afterwards -- without it, a user who
 * picked the wrong time (or whose shift changed) had no path back to it
 * short of re-running onboarding, which the (app) layout gate only offers
 * while onboarding_completed is still false.
 */
export async function updateNotificationTimes(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();

  const parsed = z
    .object({
      morningTime: TimeSchema,
      nightTime: TimeSchema,
      sundayTime: TimeSchema,
    })
    .safeParse({
      morningTime: formData.get("morningTime"),
      nightTime: formData.get("nightTime"),
      sundayTime: formData.get("sundayTime"),
    });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        morning_notification_time: parsed.data.morningTime,
        night_notification_time: parsed.data.nightTime,
        sunday_notification_time: parsed.data.sundayTime,
      })
      .eq("id", session.userId);

    if (error) {
      return { status: "error", message: "Something went wrong saving this. Please try again." };
    }
  } catch {
    return { status: "error", message: "Something went wrong saving this. Please try again." };
  }

  revalidatePath("/settings");
  revalidatePath("/home");
  return { status: "success" };
}

/**
 * "Users choose their own display name -- does not have to be their real
 * name" (brief). Community-facing (see src/lib/community/queries.ts) but
 * edited from the Community right rail, not a dedicated settings page --
 * matches where the design reference puts it.
 */
export async function updateDisplayName(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();

  const parsed = DisplayNameSchema.safeParse(formData.get("displayName"));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: parsed.data })
      .eq("id", session.userId);

    if (error) {
      return { status: "error", message: "Something went wrong saving this. Please try again." };
    }
  } catch {
    return { status: "error", message: "Something went wrong saving this. Please try again." };
  }

  revalidatePath("/community");
  revalidatePath("/community/wins");
  revalidatePath("/community/company");
  return { status: "success" };
}
