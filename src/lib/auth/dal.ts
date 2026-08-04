import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

/**
 * Data Access Layer per docs/app/guides/authentication.md — centralizes the
 * session check so every Server Component/Action/Route Handler goes through
 * one place. Deliberately uses `supabase.auth.getUser()`, not `getSession()`:
 * getUser() re-validates the JWT against the Supabase Auth server, whereas
 * getSession() just trusts whatever is in the cookie. This matters here
 * because auth.uid() from a spoofed/stale session would be the one thing
 * that could undermine the RLS boundary in supabase/migrations.
 */
export const verifySession = cache(async () => {
  const supabase = await createClient();

  // Wrapped in try/catch, not just the `{ error }`/`{ data: { user: null } }`
  // return Supabase's own typings promise: auth-js's own source
  // (node_modules/@supabase/auth-js) only resolves getUser() normally when
  // it recognizes a failure as an AuthError -- anything it doesn't
  // recognize is re-thrown. Unwrapped, that crashed to Next's generic error
  // page on every protected page load (this runs via proxy.ts on nearly
  // every route), not just here -- see the identical fix already applied to
  // every supabase.auth.* call in lib/actions/auth.ts.
  let user;
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  } catch {
    user = null;
  }

  if (!user) {
    redirect("/login");
  }

  return { userId: user.id, email: user.email };
});

export const getProfile = cache(async (): Promise<Profile> => {
  const session = await verifySession();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.userId)
    .single();

  if (error || !data) {
    redirect("/login");
  }

  return data as Profile;
});

/** For (admin) routes: verifies the session AND that the user is an hr_admin. */
export const requireHrAdmin = cache(async (): Promise<Profile> => {
  const profile = await getProfile();

  if (profile.role !== "hr_admin") {
    redirect("/home");
  }

  return profile;
});

/**
 * For the community moderation queue: verifies the session AND that the
 * user is an ntitt_admin -- a separate role from hr_admin, deliberately.
 * See docs/ARCHITECTURE.md "Community scope": an hr_admin's dashboard
 * access must never imply any community moderation right, so this must
 * never fall back to accepting hr_admin.
 */
export const requireNtittAdmin = cache(async (): Promise<Profile> => {
  const profile = await getProfile();

  if (profile.role !== "ntitt_admin") {
    redirect("/home");
  }

  return profile;
});
