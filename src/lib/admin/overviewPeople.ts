import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  summarizePeople,
  type CompanyRow,
  type PeopleOverview,
  type PeopleProfileRow,
} from "@/lib/admin/overviewPeopleSummary";

export { emptyPeopleOverview } from "@/lib/admin/overviewPeopleSummary";
export type { PeopleOverview } from "@/lib/admin/overviewPeopleSummary";

/**
 * The Admin Overview "People & tenants" gatherer. RLS deliberately gives even an
 * `ntitt_admin` no read on other users' `profiles` rows (own-row-only, by
 * design — see 20260730000000_init_schema.sql and lib/admin/superAdmins.ts), so
 * a platform-wide member/tenant count is the one legitimate use of the
 * service-role client here. It reads ONLY non-private profile columns (identity +
 * coarse activity) and company names — never the `private` schema, never any
 * routine/check-in/review content. Call from an `ntitt_admin`-guarded surface only.
 */

// PostgREST caps a response at ~1000 rows and silently truncates, so a
// platform-wide read MUST page — same reasoning + pattern as the participation
// cron's fetchAll (src/app/api/jobs/aggregate-participation/route.ts).
const PAGE_SIZE = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, any>;

async function fetchAllProfiles(admin: AdminClient): Promise<PeopleProfileRow[]> {
  const rows: PeopleProfileRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("profiles")
      .select("company_id, role, created_at, onboarding_completed, community_opt_in, podcast_guest_opt_in, last_seen_at")
      .range(from, from + PAGE_SIZE - 1);
    // Hard-fail rather than silently under-count: a partial page would report a
    // wrong headcount, which is worse than the page degrading to its zero-state.
    if (error) throw error;
    const batch = (data ?? []) as PeopleProfileRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function getPeopleOverview(): Promise<PeopleOverview> {
  const admin = createAdminClient();
  const profiles = await fetchAllProfiles(admin);

  const companyIds = [...new Set(profiles.map((p) => p.company_id))];
  const companies: CompanyRow[] = [];
  if (companyIds.length > 0) {
    const { data, error } = await admin.from("companies").select("id, name").in("id", companyIds);
    if (error) throw error;
    companies.push(...((data ?? []) as CompanyRow[]));
  }

  return summarizePeople(profiles, companies, Date.now());
}
