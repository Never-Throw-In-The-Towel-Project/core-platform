import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeOverallTrend,
  computeTrendDelta,
  getReviewCompletions,
  getSupportCount,
  getWeeklyParticipation,
} from "@/lib/dashboard/aggregates";
import { summarizeEngagement, type CompanyEngagement, type EngagementOverview } from "@/lib/admin/overviewEngagementSummary";

export { emptyEngagementOverview } from "@/lib/admin/overviewEngagementSummary";
export type { EngagementOverview } from "@/lib/admin/overviewEngagementSummary";

/**
 * The Admin Overview "Company engagement" gatherer: every tenant's anonymised
 * participation / review / support aggregates, rolled up for the super admin.
 *
 * The `company_*` aggregate tables are RLS-scoped to each company's own HR admin
 * (no `ntitt_admin` read policy — see init_schema.sql), so a cross-tenant read
 * uses the service-role client, exactly like the day-90 report cron. It reads
 * ONLY those pre-anonymised public aggregate tables (counts + percentages that
 * an HR admin already sees for their own team) — never the `private` schema, and
 * never any individual's routine/check-in/review rows. Call from an
 * `ntitt_admin`-guarded surface only.
 *
 * Reuses the tested per-company helpers in lib/dashboard/aggregates.ts, one
 * company at a time (parallelised). That's a handful of queries per tenant; at
 * NTITT's tenant count this is comfortable, and it keeps the aggregation logic
 * identical to the HR dashboard rather than re-deriving it.
 */
const avg = (values: (number | null)[]): number | null => {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return Math.round(present.reduce((s, v) => s + v, 0) / present.length);
};

export async function getEngagementOverview(): Promise<EngagementOverview> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("companies").select("id, name").order("name");
  if (error) throw error;
  const companies = (data ?? []) as { id: string; name: string }[];

  const rows: CompanyEngagement[] = await Promise.all(
    companies.map(async (c): Promise<CompanyEngagement> => {
      const [weeks, reviews, supportCount] = await Promise.all([
        getWeeklyParticipation(admin, c.id),
        getReviewCompletions(admin, c.id),
        getSupportCount(admin, c.id),
      ]);

      const latest = weeks.length > 0 ? weeks[weeks.length - 1] : null;
      const delta = computeTrendDelta(weeks);

      return {
        companyId: c.id,
        name: c.name,
        hasData: weeks.length > 0,
        latestWeekNumber: latest?.weekNumber ?? null,
        latestParticipationPercent: latest
          ? avg([latest.morningPercent, latest.nightPercent, latest.themedPercent])
          : null,
        trend: computeOverallTrend(weeks),
        trendPoints: delta?.points ?? null,
        headcount: latest?.headcount ?? 0,
        reviewCompleted: reviews.reduce((n, r) => n + r.completedCount, 0),
        reviewEligible: reviews.reduce((n, r) => n + r.eligibleCount, 0),
        supportCount,
      };
    })
  );

  return summarizeEngagement(rows);
}
