import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase client for Server Components / Server Actions / Route Handlers.
 * Forwards the caller's own auth cookie, so every query runs as that user's
 * session (`authenticated` role, `auth.uid()` resolves to them) and is
 * subject to the RLS policies in supabase/migrations — this is what makes
 * the private-schema access boundary actually work. Never use this client
 * for cross-user aggregation; that's what `admin.ts` is for.
 *
 * `schema` defaults to `public`. supabase/config.toml exposes multiple
 * schemas (`public`, `private`, `graphql_public`) via PostgREST, and per
 * PostgREST/postgrest-js, a client that doesn't explicitly select a schema
 * always targets the default (`public`) -- it does NOT search across every
 * exposed schema. Every table in the `private` schema (morning_entries,
 * night_entries, themed_checkins, sunday_setups, weekly_reviews,
 * periodic_reviews, support_requests) MUST be queried via
 * `createClient("private")`, or the query 404s against a real Supabase
 * instance even though RLS would have allowed it. Found and fixed after
 * Phase 1-3 all queried these tables with no schema override -- tsc/lint/
 * build never catch this class of bug since none of them touch the network;
 * only a real PostgREST round-trip does. See docs/ARCHITECTURE.md.
 */
export async function createClient(schema: "public" | "private" = "public") {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render (not a Server Action or
            // Route Handler) where cookies can't be set. Safe to ignore as
            // long as proxy.ts is refreshing the session — see src/proxy.ts.
          }
        },
      },
    }
  );
}
