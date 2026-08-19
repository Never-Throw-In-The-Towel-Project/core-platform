import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * A minimal, browser-side Supabase client used ONLY for token-authorised direct
 * uploads (storage.uploadToSignedUrl). It carries no user session — the signed
 * upload token minted by the server IS the authorisation — so it needs no cookie
 * wiring, unlike lib/supabase/server.ts. Kept out of `admin.ts`/`server.ts`
 * (both "server-only") so it can be imported from a client component.
 *
 * Instantiated lazily and memoised so we don't build a client per keystroke.
 */
let cached: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (!cached) {
    cached = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return cached;
}
