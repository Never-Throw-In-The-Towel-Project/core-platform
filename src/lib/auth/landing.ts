import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Where each role lands after login -- their own journey's home. ntitt_admin →
 * the Control Tower, hr_admin → their Workspace, everyone else → the member
 * Today screen. (Until Phase 0's domains + cross-subdomain SSO land these are
 * all same-host paths; afterwards the host rewrite maps them onto the right
 * subdomain -- see docs/PLATFORM_STRUCTURE.md.)
 */
export function roleHomePath(role: UserRole): string {
  switch (role) {
    case "ntitt_admin":
      return "/admin";
    case "hr_admin":
      return "/workspace";
    default:
      return "/home";
  }
}

/**
 * Post-auth destination. Honours an explicit, already-validated `next` (a deep
 * link the user was bounced from); otherwise sends them to their role's home. A
 * user who hasn't finished onboarding goes there first, regardless of role.
 * Uses the passed authenticated client so it sees the session just established.
 * Falls back to `next ?? "/home"` if the profile can't be read.
 */
export async function resolveLandingPath(supabase: ServerClient, next: string | null): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return next ?? "/home";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return next ?? "/home";
  if (!profile.onboarding_completed) return "/onboarding";
  return next ?? roleHomePath(profile.role);
}
