import { createClient } from "@supabase/supabase-js";
import { escapeFilterValue } from "@/lib/supabase/filterEscape";
import type { Company } from "@/types/database";

// Subdomains that never resolve to a tenant: "app"/"www" are the un-branded
// default host. Exported so company creation can reject them as slugs -- a
// company with one of these slugs could never have its subdomain resolve.
export const RESERVED_SUBDOMAINS = new Set(["app", "www"]);

/**
 * Pulls the tenant slug out of a request's Host header, for both production
 * (`kpsnacks.ntitt.co.uk`) and local dev (`kpsnacks.localhost:3000`).
 * Returns null for the un-branded default app (`app.ntitt.co.uk`,
 * `ntitt.co.uk` itself, or bare `localhost`) — those get default NTITT
 * branding, not a company theme.
 */
export function extractTenantSlug(host: string): string | null {
  const hostname = host.split(":")[0].toLowerCase();
  const rootDomain = (process.env.NEXT_PUBLIC_APP_ROOT_DOMAIN ?? "ntitt.co.uk").toLowerCase();

  let candidate: string | null = null;

  if (hostname.endsWith(`.${rootDomain}`)) {
    candidate = hostname.slice(0, -(rootDomain.length + 1));
  } else if (hostname.endsWith(".localhost")) {
    candidate = hostname.slice(0, -".localhost".length);
  }

  if (!candidate || candidate.includes(".") || RESERVED_SUBDOMAINS.has(candidate)) {
    return null;
  }

  return candidate;
}

/**
 * Resolves a request's Host header to a company (by subdomain slug or a
 * flagship client's custom domain). Company branding is public-readable
 * (see the migration's "companies are publicly readable" policy), so the
 * anon key is sufficient here — no service role needed, and this is safe to
 * call before a user is authenticated (e.g. to brand the login page).
 *
 * Perf note for later: this is one DB round-trip per request when called
 * from proxy.ts. Fine for the foundation phase; worth caching (short-TTL,
 * keyed by hostname) once real traffic makes it worth the complexity.
 */
export async function resolveCompanyForHost(host: string): Promise<Company | null> {
  const hostname = host.split(":")[0].toLowerCase();
  const slug = extractTenantSlug(host);

  if (!slug && !hostname.endsWith(process.env.NEXT_PUBLIC_APP_ROOT_DOMAIN ?? "ntitt.co.uk")) {
    // Not a recognized subdomain pattern at all -- still check for a
    // flagship client's custom domain (e.g. wellbeing.some-client.com).
  } else if (!slug) {
    return null; // bare root/app domain -- default NTITT branding
  }

  // Wrapped in try/catch: createClient() (here, the base @supabase/
  // supabase-js one, not lib/supabase/server.ts's SSR wrapper) throws
  // synchronously if the URL/key are missing or malformed -- same failure
  // mode already guarded on the auth-critical path (lib/auth/dal.ts,
  // proxy.ts, lib/actions/auth.ts, lib/routines/*). This one is far more
  // universal than any of those: it runs unconditionally in the ROOT
  // layout (src/app/layout.tsx) on every single request, including the
  // public marketing homepage and /login, before any auth check even
  // happens. A throw here also isn't caught by error.tsx -- error
  // boundaries don't wrap the layout they're defined alongside, only
  // global-error.tsx catches a root layout failure (node_modules/next/
  // dist/docs/.../error.md). Degrading to null (default NTITT branding,
  // the same fallback already used for the bare root/app domain case
  // above) is the safe direction: a company's custom theme failing to load
  // should never take down the entire site for everyone.
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // hostname/slug are derived from the request's Host header -- external
    // input. Quoted (PostgREST's escape mechanism for .or() filter values)
    // so a crafted Host header containing a comma or parenthesis can't
    // inject an extra filter condition instead of just failing to match a
    // company.
    const escapedHostname = escapeFilterValue(hostname);
    const orFilter = slug
      ? `custom_domain.eq."${escapedHostname}",slug.eq."${escapeFilterValue(slug)}"`
      : `custom_domain.eq."${escapedHostname}"`;

    // Explicit branding/identity columns only -- never `select("*")`. The
    // support_contact_* columns and ninety_day_report_sent_at are no longer
    // granted to the anon role (see
    // 20260810020000_restrict_company_contact_columns.sql), so `*` would
    // error here; and this pre-auth, every-request path has no business
    // reading a company's support-contact PII regardless.
    const { data } = await supabase
      .from("companies")
      .select(
        "id, name, slug, custom_domain, logo_url, primary_color, accent_color, welcome_copy, created_at"
      )
      .or(orFilter)
      .maybeSingle();

    return (data as Company) ?? null;
  } catch {
    return null;
  }
}
