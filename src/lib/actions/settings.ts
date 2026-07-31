"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifySession } from "@/lib/auth/dal";
import { type RoutineActionState } from "./routineState";

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

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ timezone: parsed.data })
    .eq("id", session.userId);

  if (error) {
    return { status: "error", message: "Something went wrong saving this. Please try again." };
  }

  revalidatePath("/settings");
  revalidatePath("/home");
  return { status: "success" };
}
