import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { appRootDomain, isHostUnderRootDomain } from "@/lib/tenant/resolve";
import type { UserRole } from "@/types/database";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Where each role lands after login -- their own journey's home PATH.
 * ntitt_admin → the Control Tower, hr_admin → their Workspace, everyone else →
 * the member Today screen. This is only the path; crossSubdomainLanding() maps
 * it onto the role's own subdomain host -- see docs/PLATFORM_STRUCTURE.md.
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
 * The host a role's home lives on in the three-site model: ntitt_admin →
 * `admin.<root>`, hr_admin → `<companySlug>.<root>`, everyone else → wherever
 * they already are. Returns null ("stay on the current host") when the role has
 * no dedicated host, when the hr_admin's company slug is unknown, or when the
 * current host is already the right one (so there's never a redundant bounce).
 */
export function roleHomeHost(
  role: UserRole,
  currentHostname: string,
  companySlug: string | null
): string | null {
  const root = appRootDomain();
  let target: string | null = null;
  if (role === "ntitt_admin") target = `admin.${root}`;
  else if (role === "hr_admin" && companySlug) target = `${companySlug}.${root}`;

  if (!target || target === currentHostname) return null;
  return target;
}

/**
 * Maps a role's home PATH onto its own site's HOST, returning an absolute URL
 * for a cross-subdomain bounce or the plain same-host path otherwise. Only
 * bounces on real root-domain hosts -- never bare `localhost` or `*.vercel.app`
 * previews, where there are no per-role subdomains and an absolute redirect
 * would break sign-in. The parent-domain session cookie (see resolve.ts) is
 * what carries the just-established login across the bounce.
 */
export function crossSubdomainLanding(
  role: UserRole,
  homePath: string,
  currentHost: string,
  companySlug: string | null
): string {
  if (!isHostUnderRootDomain(currentHost)) return homePath;
  const hostname = currentHost.split(":")[0].toLowerCase();
  const targetHost = roleHomeHost(role, hostname, companySlug);
  return targetHost ? `https://${targetHost}${homePath}` : homePath;
}

/**
 * Post-auth destination. Honours an explicit, already-validated `next` (a deep
 * link the user was bounced from) -- which stays on whatever host they were
 * trying to reach; otherwise sends them to their role's home, mapped onto the
 * role's own subdomain (Control Tower / company portal) via
 * crossSubdomainLanding. A user who hasn't finished onboarding goes there
 * first, regardless of role. Uses the passed authenticated client so it sees
 * the session just established. Falls back to `next ?? "/home"` if the profile
 * can't be read.
 */
export async function resolveLandingPath(supabase: ServerClient, next: string | null): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return next ?? "/home";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarding_completed, company_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return next ?? "/home";
  if (!profile.onboarding_completed) return "/onboarding";
  // A deep-link `next` wins outright and stays on the current host -- only the
  // role-default home gets mapped onto the role's own site.
  if (next) return next;

  const homePath = roleHomePath(profile.role);

  // hr_admin's home lives on their company's own subdomain; look up its slug so
  // the bounce targets the right host. companies is public-readable, so the
  // user-session client is enough here. Any miss just keeps them same-host.
  let companySlug: string | null = null;
  if (profile.role === "hr_admin" && profile.company_id) {
    const { data: company } = await supabase
      .from("companies")
      .select("slug")
      .eq("id", profile.company_id)
      .maybeSingle();
    companySlug = company?.slug ?? null;
  }

  const host = (await headers()).get("host") ?? "";
  return crossSubdomainLanding(profile.role, homePath, host, companySlug);
}
