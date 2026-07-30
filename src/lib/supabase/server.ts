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
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
