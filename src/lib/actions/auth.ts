"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifySession } from "@/lib/auth/dal";
import { isSafeRedirectPath } from "@/lib/auth/redirect";

export type MagicLinkState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "sent" };

const EmailSchema = z.email();

/**
 * Employees/HR admins are provisioned by a company onboarding flow, not
 * open self-signup (see supabase/config.toml: enable_signup = false) -- so
 * this stays the entry point for anyone who hasn't set a password yet, or
 * who'd rather not. Onboarding offers an optional "set a password" step
 * (setPassword below) so returning users who set one can use
 * signInWithPassword instead; both sign in the same admin-provisioned
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
  const callbackUrl = new URL("/auth/callback", process.env.NEXT_PUBLIC_SITE_URL);
  if (next) callbackUrl.searchParams.set("next", next);

  // Wrapped in try/catch, not just the `{ error }` return Supabase's own
  // typings promise: createClient() throws synchronously if the URL/key are
  // missing or malformed (node_modules/@supabase/ssr/dist/main/
  // createServerClient.js), and auth-js's own source
  // (node_modules/@supabase/auth-js) only converts a failure into that
  // return value when it recognizes the failure as an AuthError -- anything
  // it doesn't recognize is re-thrown. Either would otherwise surface as an
  // unhandled exception here and crash to Next's generic error page instead
  // of this form's own inline message.
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: {
        emailRedirectTo: callbackUrl.toString(),
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
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      return { status: "error", message: "Incorrect email or password." };
    }
  } catch {
    return { status: "error", message: "Incorrect email or password." };
  }

  redirect(next ?? "/home");
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
