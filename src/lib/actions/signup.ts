"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveCompanyForHost } from "@/lib/tenant/resolve";
import { DIRECT_COMPANY_ID } from "@/lib/tenant/constants";
import { isSafeRedirectPath } from "@/lib/auth/redirect";
import { generateAnonHandle } from "@/lib/identity/preference";
import { CURRENT_TERMS_VERSION } from "@/lib/legal/consent";
import { type RoutineActionState } from "./routineState";

const SignupSchema = z
  .object({
    email: z.email(),
    password: z.string().min(8, "Use at least 8 characters."),
    confirmPassword: z.string(),
    fullName: z.string().trim().min(1, "Enter your full name.").max(120),
    // DOB is collected but NOT age-gated (product decision; the Terms' "16 or
    // over" line is left for solicitor review). Reject only the impossible.
    dateOfBirth: z
      .string()
      .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date of birth.")
      .refine((v) => new Date(v) <= new Date(), "Your date of birth can't be in the future.")
      .refine((v) => new Date(v).getUTCFullYear() >= 1900, "Enter a valid date of birth."),
    identityPreference: z.enum(["full_name", "first_name_only", "anonymous"]),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

/**
 * Direct/public self-service signup only -- always assigns the shared
 * "NTITT Direct" company (DIRECT_COMPANY_ID) and the "employee" role,
 * never taken from form input, same invariant inviteEmployee/
 * inviteStaffMember (lib/actions/invite.ts) enforce for their own
 * company_id/role. Partner co-branded companies stay invite-only: refuses
 * to run at all when the request's host resolves to a company (checked
 * here too, not just in src/app/signup/page.tsx, since a server action is
 * reachable independently of how its page renders).
 *
 * The profiles row is upserted directly here via the admin client, right
 * after signUp succeeds -- not left to the handle_new_user trigger, same
 * reasoning as invite.ts: testing that flow found Supabase's invite API
 * doesn't reliably attach user_metadata to the same auth.users insert the
 * trigger fires on, and there's no reason to trust supabase.auth.signUp()
 * more than that without the same verification, so this mirrors the
 * already-proven pattern rather than assuming.
 */
export async function signUp(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const host = (await headers()).get("host") ?? "";
  const partnerCompany = await resolveCompanyForHost(host);
  if (partnerCompany) {
    return { status: "error", message: "Self-service signup isn't available here. Please sign in instead." };
  }

  // Consent to Terms + Privacy is required to create an account (the form
  // checkbox is `required`, but a server action is reachable independently of
  // its page, so re-check here -- same defence-in-depth as the host guard above).
  if (formData.get("consent") !== "yes") {
    return { status: "error", message: "Please agree to the Terms of Service and Privacy Policy to continue." };
  }

  const parsed = SignupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    fullName: formData.get("fullName"),
    dateOfBirth: formData.get("dateOfBirth"),
    identityPreference: formData.get("identityPreference"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  const requestedNext = formData.get("next");
  const next =
    typeof requestedNext === "string" && isSafeRedirectPath(requestedNext) ? requestedNext : "/onboarding";

  // Wrapped in try/catch: see signInWithMagicLink's comment (lib/actions/
  // auth.ts) on why createClient() and auth-js can both throw outside the
  // `{ error }` contract -- and why `new URL()` (which throws on an
  // unset/invalid NEXT_PUBLIC_SITE_URL) belongs inside it too.
  let signUpResult;
  try {
    const callbackUrl = new URL("/auth/callback", process.env.NEXT_PUBLIC_SITE_URL);
    callbackUrl.searchParams.set("next", next);
    const supabase = await createClient();
    signUpResult = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: callbackUrl.toString(),
        data: {
          company_id: DIRECT_COMPANY_ID,
          role: "employee",
          // Transient: the hardened handle_new_user trigger uses this for its
          // pre-insert; the service-role upsert below immediately overwrites
          // display_name with the generated public handle and sets full_name.
          display_name: parsed.data.fullName,
        },
      },
    });
  } catch {
    return { status: "error", message: "Couldn't create your account. Please try again." };
  }

  const { data, error } = signUpResult;
  if (error || !data.user) {
    // Collapsed generic message, same convention as signInWithMagicLink --
    // also covers "already registered" when email confirmation is off (the
    // one case Supabase reports as a real error instead of the
    // empty-identities signal handled below).
    return { status: "error", message: "Couldn't create your account. Please try again." };
  }

  // Anti-enumeration: when email confirmation is required, Supabase
  // returns a user object with an EMPTY identities array (not an error)
  // when the email already belongs to an existing account -- its own
  // documented behavior for signUp(). Treat that identically to a genuine
  // new signup in the response, and -- this is the part that matters --
  // never touch profiles for it: data.user.id there belongs to a real,
  // already-provisioned account, and upserting would silently overwrite
  // that person's real company_id/role/display_name.
  const isGenuinelyNewUser = (data.user.identities?.length ?? 0) > 0;

  if (isGenuinelyNewUser) {
    const admin = createAdminClient();
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: data.user.id,
        company_id: DIRECT_COMPANY_ID,
        role: "employee",
        // The REAL name (admin-visible identity) comes from the form; the public
        // handle other members see when this person is anonymous defaults to a
        // stable, non-identifying nickname they can change in settings.
        full_name: parsed.data.fullName,
        display_name: generateAnonHandle(data.user.id),
        date_of_birth: parsed.data.dateOfBirth,
        community_identity_preference: parsed.data.identityPreference,
        // Durable proof-of-consent for the Terms & Privacy tick (service-role
        // write only -- a record the member could rewrite wouldn't be proof).
        tc_agreed_at: new Date().toISOString(),
        tc_version: CURRENT_TERMS_VERSION,
      },
      { onConflict: "id" }
    );
    if (profileError) {
      // Mirrors invite.ts's identical failure mode: the auth-side call
      // already succeeded and can't be undone from here.
      return {
        status: "error",
        message: "Account created, but finishing setup failed. Please try again.",
      };
    }
  }

  // If email confirmation is off, signUp() already returned an active
  // session and lib/supabase/server.ts's SSR client already persisted the
  // session cookie on this response -- same as signInWithPassword, no
  // /auth/callback hop needed. Otherwise data.session is null and the
  // confirmation email (built with callbackUrl above) is how they actually
  // get a session, via /auth/callback.
  if (data.session) {
    redirect(next);
  }

  return { status: "success" };
}
