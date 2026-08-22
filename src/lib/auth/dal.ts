import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

/** At most one activity stamp per hour per member — matches the throttle baked
 *  into the touch_last_seen() SQL function, so within the hour we skip the RPC
 *  round-trip entirely (the value we just read tells us it's fresh). */
const LAST_SEEN_THROTTLE_MS = 60 * 60 * 1000;

/**
 * Best-effort activity stamp for the admin active-users metric. Fires the
 * throttled, self-only touch_last_seen() RPC (see 20260831000000) only when the
 * profile we just loaded is stale, so most page loads make no extra query. Any
 * failure is swallowed: recording activity must NEVER break a page render.
 */
async function recordActivity(
  // Loose typing (the RPC name isn't in a generated Database type) — same
  // escape hatch as lib/content/queries.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any>,
  profile: Profile
): Promise<void> {
  const lastMs = profile.last_seen_at ? Date.parse(profile.last_seen_at) : 0;
  if (Number.isFinite(lastMs) && Date.now() - lastMs < LAST_SEEN_THROTTLE_MS) return;
  try {
    await supabase.rpc("touch_last_seen");
  } catch {
    // Activity tracking is best-effort; never surface it to the user.
  }
}

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
  // Wrapped in try/catch, not just the `{ error }`/`{ data: { user: null } }`
  // return Supabase's own typings promise: `createServerClient()` throws
  // synchronously if the URL/key are missing or malformed
  // (node_modules/@supabase/ssr/dist/main/createServerClient.js), and
  // auth-js's own source (node_modules/@supabase/auth-js) only resolves
  // getUser() normally when it recognizes a failure as an AuthError --
  // anything it doesn't recognize is re-thrown. Unwrapped, either crashed
  // to Next's generic error page on every protected page load (this runs
  // via proxy.ts on nearly every route), not just here -- see the identical
  // fix already applied to every supabase.auth.* call in
  // lib/actions/auth.ts.
  let user;
  try {
    const supabase = await createClient();
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

  // Same reasoning as verifySession() above: createClient() and the query
  // that follows can both throw for reasons unrelated to "no such profile"
  // (a dropped connection, a malformed env var), and a throw here is just
  // as much "this user isn't in a valid session" as the existing
  // `error || !data` check already treats it -- both should redirect, not
  // crash.
  let profile: Profile | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let client: SupabaseClient<any, any> | null = null;
  try {
    const supabase = await createClient();
    client = supabase;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.userId)
      .single();
    if (!error && data) {
      profile = data as Profile;
    }
  } catch {
    profile = null;
  }

  if (!profile) {
    redirect("/login");
  }

  // Stamp coarse activity for the admin active-users metric. Awaited so it
  // completes in the serverless request, but throttled to a no-op within the
  // hour (see recordActivity), so it costs a round-trip at most hourly.
  if (client) {
    await recordActivity(client, profile);
  }

  return profile;
});

/**
 * Like getProfile() but returns null instead of redirecting when there's no
 * session -- for routes that render for BOTH logged-in and logged-out visitors
 * (e.g. the public+member Events page). cache()-wrapped so a layout and its page
 * share one lookup per request.
 */
export const getOptionalProfile = cache(async (): Promise<Profile | null> => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    return (data as Profile | null) ?? null;
  } catch {
    return null;
  }
});

/** For (company) routes: verifies the session AND that the user is an hr_admin. */
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
