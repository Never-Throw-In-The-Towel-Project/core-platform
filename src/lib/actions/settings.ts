"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifySession } from "@/lib/auth/dal";
import { generateAnonHandle } from "@/lib/identity/preference";
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
 * name" (brief). Community-facing (see src/lib/community/queries.ts). Editable
 * from two places that share this action: the Community right rail, and the
 * per-role Settings pages (member /settings, HR /workspace/settings, super
 * admin /admin/settings) -- hence the settings revalidations below alongside
 * the community boards.
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
  revalidatePath("/settings");
  // "layout" so the display name shown in each role shell's chrome refreshes
  // too, not just the page it was edited on: the member (app) header initial,
  // the (company) header, and the Admin sidebar. /home names the (app) layout.
  revalidatePath("/home", "layout");
  revalidatePath("/workspace", "layout");
  revalidatePath("/admin", "layout");
  return { status: "success" };
}

/**
 * A member's own identity details: their REAL name (admin-visible), optionally
 * their date of birth, and their community appearance preference. All three are
 * gathered at signup; this is the only way to change them afterwards -- and how
 * a member created before signup started collecting them fills them in.
 *
 * full_name and community_identity_preference are always written; date_of_birth
 * is written only when a value is supplied, so changing your preference never
 * forces you to enter a DOB and a blank field never clears an already-set one.
 * The public handle (display_name, shown only when anonymous) is edited
 * separately via updateDisplayName. All three columns here are in the
 * per-column self-service UPDATE grant (20260908000000).
 */
const IdentitySchema = z.object({
  fullName: z.string().trim().min(1, "Enter your full name.").max(120),
  identityPreference: z.enum(["full_name", "first_name_only", "anonymous"]),
});

export async function updateIdentity(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();

  const parsed = IdentitySchema.safeParse({
    fullName: formData.get("fullName"),
    identityPreference: formData.get("identityPreference"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  // DOB optional here (unlike signup): validate only when supplied. No age gate,
  // same as signup -- reject only the impossible (unparseable / future / pre-1900).
  const dobRaw = formData.get("dateOfBirth");
  let dateOfBirth: string | undefined;
  if (typeof dobRaw === "string" && dobRaw.trim()) {
    const t = Date.parse(dobRaw);
    if (Number.isNaN(t) || new Date(t) > new Date() || new Date(t).getUTCFullYear() < 1900) {
      return { status: "error", message: "Enter a valid date of birth." };
    }
    dateOfBirth = dobRaw;
  }

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  try {
    const supabase = await createClient();

    // Choosing to appear anonymously must not leave the public handle set to the
    // member's real name. Invited/legacy members were provisioned with
    // display_name == full_name, so without this they'd post "anonymously" under
    // their real name (finding A3). If their handle is still their real name
    // (never customised via updateDisplayName), swap in a generated one now; a
    // handle they've already personalised is left untouched.
    let handleFix: { display_name: string } | undefined;
    if (parsed.data.identityPreference === "anonymous") {
      const { data: current } = await supabase
        .from("profiles")
        .select("display_name, full_name")
        .eq("id", session.userId)
        .maybeSingle();
      if (current && current.display_name === current.full_name) {
        handleFix = { display_name: generateAnonHandle(session.userId) };
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.fullName,
        community_identity_preference: parsed.data.identityPreference,
        ...(dateOfBirth ? { date_of_birth: dateOfBirth } : {}),
        ...(handleFix ?? {}),
      })
      .eq("id", session.userId);

    if (error) {
      return { status: "error", message: "Something went wrong saving this. Please try again." };
    }
  } catch {
    return { status: "error", message: "Something went wrong saving this. Please try again." };
  }

  // Name/preference changes affect how the member appears in the community.
  revalidatePath("/settings");
  revalidatePath("/community", "layout");
  revalidatePath("/home", "layout");
  return { status: "success" };
}
