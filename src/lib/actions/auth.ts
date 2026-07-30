"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type MagicLinkState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "sent" };

const EmailSchema = z.email();

/**
 * Employees/HR admins are provisioned by a company onboarding flow, not
 * open self-signup (see supabase/config.toml: enable_signup = false), so
 * login is a magic link to an existing account rather than a password form.
 */
export async function signInWithMagicLink(
  _prevState: MagicLinkState,
  formData: FormData
): Promise<MagicLinkState> {
  const parsed = EmailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { status: "error", message: "Please enter a valid email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    return { status: "error", message: "Couldn't send the sign-in link. Please try again." };
  }

  return { status: "sent" };
}
