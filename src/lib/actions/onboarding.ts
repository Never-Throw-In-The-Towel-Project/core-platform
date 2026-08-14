"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifySession } from "@/lib/auth/dal";
import { resolveLandingPath } from "@/lib/auth/landing";
import { type RoutineActionState } from "./routineState";
import { TimeSchema, DisplayNameSchema } from "./schemas";

/**
 * Last step of onboarding (design reference frame 1j: "notification times
 * and display name in one ruled sheet") -- a single write for the whole
 * sheet, ending with onboarding_completed so the (app) layout's gate opens.
 * There's no separate "step 4" screen: the reference's own step-3 button
 * ("Finish setup") links straight to the Today screen, so landing there
 * *is* the fourth step.
 *
 * Redirects itself (rather than returning "success" for the client to
 * router.push) -- redirecting here was previously left to the client via
 * useEffect, but this action's own revalidatePath("/home") call makes
 * Next.js re-render /onboarding (the route the action was invoked from) in
 * the same response, and that re-render now sees onboarding_completed=true
 * and throws its own redirect("/home") from the page component -- racing
 * the client's router.push and crashing. Calling redirect() here instead
 * is the documented pattern (node_modules/next/dist/docs/.../redirect.md's
 * own Server Action example) and it's the only code path that runs, so the
 * race can't happen.
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

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed (node_modules/@supabase/ssr/dist/main/
  // createServerClient.js), the same gap already closed on every other
  // read in the auth-critical path (lib/auth/dal.ts, lib/actions/auth.ts,
  // /home's render chain) but missed here -- this is the one write that
  // finishes onboarding, so an unrecognized failure took the user to
  // Next's error boundary one tap from the end of the flow instead of
  // this form's own retryable message.
  // Onboarding just completed, so role-aware landing now resolves to the
  // role's home (not back to /onboarding). Default holds if the read hiccups.
  let dest = "/home";
  try {
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
      // Logged (not just swallowed): the generic message is all the user
      // sees, but without this, a real Postgrest rejection (RLS denial,
      // constraint violation, bad column) leaves no trace anywhere -- this
      // is the one line standing between "still broken" and knowing why.
      console.error("finishOnboarding: profiles update failed", error);
      return { status: "error", message: "Something went wrong saving this. Please try again." };
    }
    try {
      dest = await resolveLandingPath(supabase, null);
    } catch {
      // keep the safe default destination
    }
  } catch (err) {
    console.error("finishOnboarding: unexpected error", err);
    return { status: "error", message: "Something went wrong saving this. Please try again." };
  }

  revalidatePath("/settings");
  revalidatePath("/community");
  revalidatePath("/community/wins");
  revalidatePath("/community/company");
  redirect(dest);
}
