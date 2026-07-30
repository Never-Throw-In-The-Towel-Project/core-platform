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
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    redirect("/");
  }

  return profile;
});
