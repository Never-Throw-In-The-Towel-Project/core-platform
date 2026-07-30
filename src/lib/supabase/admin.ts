import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. This BYPASSES Row Level Security entirely —
 * it is the one client in the codebase that can read across every user's
 * private data at once.
 *
 * Only ever call this from:
 *   - the scheduled aggregation job (private -> public rollups, see
 *     docs/ARCHITECTURE.md "Aggregation job")
 *   - the 90-day PDF report generator
 *   - the support-request alert dispatcher, ONLY to read the company's
 *     support_contact_* routing info, never another user's request content
 *
 * Do not use this client inside a Server Action or page that runs on behalf
 * of a specific end user's request — use lib/supabase/server.ts there so
 * RLS stays in force. If you're reaching for this file to "just make an RLS
 * error go away", that's a sign the RLS policy is wrong, not that this is
 * the right fix.
 */
export function createAdminClient(schema: "public" | "private" = "public") {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
