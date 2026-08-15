"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifySession } from "@/lib/auth/dal";
import { isSafeRedirectPath } from "@/lib/auth/redirect";
import { resolveLandingPath } from "@/lib/auth/landing";

export type MagicLinkState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "sent" };

const EmailSchema = z.email();

/**
 * Sign the current user out and return them to /login. Wired to the header's
 * account menu -- there was no sign-out entry point anywhere in the app before.
 * redirect() is called outside any try/catch (it signals via a thrown error).
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Sign-in only -- never creates an account. `shouldCreateUser: false` is
 * load-bearing now that enable_signup is true (supabase/config.toml, for
 * src/lib/actions/signup.ts's self-service flow): without it, an unknown
 * email typed into this form would silently create a new auth.users row
 * with no company_id in its metadata, landing on handle_new_user's no-op
 * fallback (supabase/migrations/20260731090000_fix_handle_new_user_non_blocking.sql)
 * -- a real account with no profiles row at all, which getProfile() then
 * treats as "no such profile" and bounces back to /login with no
 * explanation. Real self-service account creation belongs to
 * src/app/signup/, not this form.
 *
 * Onboarding offers an optional "set a password" step (setPassword below)
 * so a magic-link- or invite-provisioned user who sets one can use
 * signInWithPassword instead; both sign in the same already-provisioned
 * account, this just avoids waiting on an email round-trip.
 */
export async function signInWithMagicLink(
  _prevState: MagicLinkState,
  formData: FormData
): Promise<MagicLinkState> {
  const parsed = EmailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { status: "error", message: "Please enter a valid email address." };
  }

  // Carries proxy.ts's "return here after login" target through the magic
  // link so /auth/callback can honour it -- previously dropped entirely,
  // so every login landed on /home regardless of what page was requested.
  const requestedNext = formData.get("next");
  const next =
    typeof requestedNext === "string" && isSafeRedirectPath(requestedNext) ? requestedNext : null;

  // Wrapped in try/catch, not just the `{ error }` return Supabase's own
  // typings promise: createClient() throws synchronously if the URL/key are
  // missing or malformed (node_modules/@supabase/ssr/dist/main/
  // createServerClient.js), and auth-js's own source
  // (node_modules/@supabase/auth-js) only converts a failure into that
  // return value when it recognizes the failure as an AuthError -- anything
  // it doesn't recognize is re-thrown. Either would otherwise surface as an
  // unhandled exception here and crash to Next's generic error page instead
  // of this form's own inline message. `new URL()` is inside the try too: an
  // unset/invalid NEXT_PUBLIC_SITE_URL throws a TypeError here that would
  // otherwise crash uncaught (it sits before the createClient call).
  try {
    const callbackUrl = new URL("/auth/callback", process.env.NEXT_PUBLIC_SITE_URL);
    if (next) callbackUrl.searchParams.set("next", next);
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: {
        emailRedirectTo: callbackUrl.toString(),
        shouldCreateUser: false,
      },
    });

    if (error) {
      return { status: "error", message: "Couldn't send the sign-in link. Please try again." };
    }
  } catch {
    return { status: "error", message: "Couldn't send the sign-in link. Please try again." };
  }

  return { status: "sent" };
}

export type PasswordLoginState = { status: "idle" } | { status: "error"; message: string };

const PasswordLoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

/**
 * Redirects itself on success rather than returning a "success" state for
 * the client to route on -- same reasoning as finishOnboarding
 * (lib/actions/onboarding.ts): calling redirect() here is the only code
 * path that runs, so there's no client-side router.push left to race a
 * server-side redirect elsewhere.
 */
export async function signInWithPassword(
  _prevState: PasswordLoginState,
  formData: FormData
): Promise<PasswordLoginState> {
  const parsed = PasswordLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Please enter your email and password." };
  }

  const requestedNext = formData.get("next");
  const next =
    typeof requestedNext === "string" && isSafeRedirectPath(requestedNext) ? requestedNext : null;

  // See signInWithMagicLink's comment above on why createClient() is
  // inside this try/catch too, not just the auth call. redirect()
  // deliberately stays outside this block -- per node_modules/next/dist/docs
  // .../redirect.md, it works by throwing, so it must never be caught.
  let dest = next ?? "/home";
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      return { status: "error", message: "Incorrect email or password." };
    }
    // Role-aware landing (nested try: a landing-resolution hiccup must not
    // fail an already-successful sign-in -- fall back to `dest`).
    try {
      dest = await resolveLandingPath(supabase, next);
    } catch {
      // keep the safe default destination
    }
  } catch {
    return { status: "error", message: "Incorrect email or password." };
  }

  redirect(dest);
}

export type SetPasswordState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

const NewPasswordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

/**
 * Onboarding-only, optional: lets a user who was provisioned via magic link
 * add a password so future sign-ins don't need an email round-trip. Doesn't
 * touch `profiles` -- the password lives entirely in Supabase Auth's own
 * `auth.users`, same as the rest of this file.
 */
export async function setPassword(
  _prevState: SetPasswordState,
  formData: FormData
): Promise<SetPasswordState> {
  await verifySession();

  const parsed = NewPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  // See signInWithMagicLink's comment above: createClient() and auth-js can
  // both throw for reasons unwrapped by the `{ error }` return alone, which
  // -- unguarded -- crashed this exact step to Next's generic error page
  // instead of the friendly message below.
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

    if (error) {
      return { status: "error", message: "Couldn't set your password. Please try again." };
    }
  } catch {
    return { status: "error", message: "Couldn't set your password. Please try again." };
  }

  return { status: "success" };
}
