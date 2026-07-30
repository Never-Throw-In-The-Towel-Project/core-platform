import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { extractTenantSlug } from "@/lib/tenant/resolve";

// Next.js 16 renamed Middleware to Proxy (same functionality, same file
// conventions) -- this is that file, not legacy middleware.ts.
// See node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md.

// Fail-closed: everything is protected by default except this explicit
// public list. New routes are safe-by-default as the app grows, rather than
// depending on remembering to add every new protected path to a list.
const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth/callback", "/community-guidelines"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const tenantSlug = extractTenantSlug(host);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-ntitt-tenant-slug", tenantSlug ?? "");

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  // Standard Supabase SSR proxy/middleware pattern: create a client bound to
  // this request's cookies, call getUser() (revalidates against Supabase
  // Auth, not just an optimistic cookie-presence check), and propagate any
  // refreshed session cookies onto the response.
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
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|ico)$).*)",
  ],
};
