import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { extractTenantSlug, cookieDomainForHost } from "@/lib/tenant/resolve";

// Next.js 16 renamed Middleware to Proxy (same functionality, same file
// conventions) -- this is that file, not legacy middleware.ts.
// See node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md.

// Fail-closed: everything is protected by default except this explicit
// public list. New routes are safe-by-default as the app grows, rather than
// depending on remembering to add every new protected path to a list.
//
// `/api/*` is NOT gated here at all -- see the `matcher` config below, which
// excludes it from the proxy entirely. Found in a full-codebase review:
// every existing /api route (the Twilio status webhook, both Vercel Cron
// jobs, the Ask for Support "mark as contacted" ack link) is called by
// something with no Supabase session -- Twilio, Vercel's cron runner, or an
// anonymous link tap from an SMS/email -- and each already authenticates
// itself independently (Twilio request signing, a CRON_SECRET bearer token,
// or a signed ack token). Gating them here as well meant every one of them
// was silently redirected to /login instead of ever reaching its handler,
// since none of those callers carry a session. This has been broken since
// Phase 1's Twilio webhook. If a future /api route ever needs a real user
// session, gate it explicitly inside that route (verifySession()), not by
// removing this exclusion -- proxy is for browser-facing pages.
// /signup is public on every host at this layer, deliberately -- proxy has
// no DB access, so it can't tell a partner subdomain from the direct
// platform without one (and a plain hostname/slug check here still
// couldn't see a flagship client's custom_domain, which is company data,
// not a hostname pattern). The real "no self-service signup on a partner
// company" enforcement is DB-backed (resolveCompanyForHost) and lives in
// src/app/signup/page.tsx + src/lib/actions/signup.ts's signUp() itself.
// Don't "fix" this into a host check here -- it would either miss custom
// domains or duplicate a DB round-trip proxy.ts otherwise never makes.
// /community-guidelines was never a real route either -- the actual page
// (/community/guidelines) intentionally requires a session, same as the
// rest of /community.
//
// /documentary, /podcast, and /what-i-do are the public marketing site (see
// src/app/(marketing)/) -- the free "taster" that explicitly must not
// require signing in, since the actual paid content lives behind /login.
// /privacy and /terms are the public legal pages (same marketing group,
// linked from its footer) -- they MUST be reachable while logged out, both
// for the footer links and because signup links to them before an account
// exists. Any new public route under (marketing) needs adding here too.
export const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth/callback", "/documentary", "/podcast", "/what-i-do", "/privacy", "/terms"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const tenantSlug = extractTenantSlug(host);
  // Parent-domain scope for refreshed session cookies -> cross-subdomain SSO
  // (undefined on localhost / *.vercel.app, where it must not be applied).
  const cookieDomain = cookieDomainForHost(host);

  // The NTITT Control Tower subdomain: its bare root lands on the Control Tower
  // rather than the public marketing home. The /admin tree itself serves
  // normally on this host (requireNtittAdmin on the /admin layout enforces the
  // role); this is only the "/" convenience redirect.
  const hostname = host.split(":")[0].toLowerCase();
  const rootDomain = (process.env.NEXT_PUBLIC_APP_ROOT_DOMAIN ?? "neverthrowinthetowel.uk").toLowerCase();
  if (hostname === `admin.${rootDomain}` && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-ntitt-tenant-slug", tenantSlug ?? "");

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  // Wrapped in try/catch: createServerClient() throws synchronously if the
  // URL/key are missing or malformed
  // (node_modules/@supabase/ssr/dist/main/createServerClient.js), and
  // auth-js's getUser() only resolves normally when it recognizes a failure
  // as an AuthError, re-throwing anything it doesn't (see lib/auth/dal.ts's
  // verifySession(), which has the same guard for the identical reason).
  // Unwrapped, either crashed to Next's generic error page on every single
  // protected route, since this runs on nearly every request via the
  // matcher below -- not just the one page a user happened to be on.
  // Treated the same as no session: redirect to /login rather than
  // propagate the exception.
  let user;
  try {
    // Standard Supabase SSR proxy/middleware pattern: create a client bound
    // to this request's cookies, call getUser() (revalidates against
    // Supabase Auth, not just an optimistic cookie-presence check), and
    // propagate any refreshed session cookies onto the response.
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value } of cookiesToSet) {
              request.cookies.set(name, value);
            }
            response = NextResponse.next({ request: { headers: requestHeaders } });
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, cookieDomain ? { ...options, domain: cookieDomain } : options);
            }
          },
        },
      }
    );

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  } catch {
    user = null;
  }

  const pathname = request.nextUrl.pathname;

  if (!user && !isPublicPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // This is an optimistic check only (session presence + role is NOT read
  // here). The hard boundary is RLS + requireHrAdmin()/verifySession() in
  // src/lib/auth/dal.ts, run again server-side on every protected page --
  // see docs/app/guides/authentication.md's warning that Proxy must not be
  // the only line of defense.
  return response;
}

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|sw.js|.*\\.(?:svg|png|jpg|jpeg|ico)$).*)",
  ],
};
