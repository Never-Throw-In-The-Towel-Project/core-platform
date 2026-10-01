import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  companyMeetsPrivacyFloor,
  computeOverallTrend,
  getReviewCompletions,
  getSupportCount,
  getWeekdayEngagement,
  getWeeklyParticipation,
} from "@/lib/dashboard/aggregates";
import { todayISODate } from "@/lib/routines/dates";
import type { ImpactReportData } from "./ImpactReportDocument";

// See the same note in src/lib/dashboard/aggregates.ts on why this is
// intentionally loose rather than the client's real schema-union generics.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any>;

export async function collectImpactReportData(
  supabase: AnySupabaseClient,
  companyId: string,
  companyName: string
): Promise<ImpactReportData> {
  // System timestamp for a company-wide report, not any one user's local day --
  // deliberately UTC (Phase 9).
  const generatedAt = todayISODate(new Date(), "UTC");

  // k-anonymity floor (finding B1): a company below MIN_COMPANY_GROUP_SIZE
  // enrolled employees gets a suppressed report -- no figures at all -- because
  // they would describe one identifiable person. This is the REAL gate for the
  // PDF: the day-90 cron runs as service_role, which bypasses the RLS floor on
  // the aggregate tables, so it must be enforced here in code (the on-demand
  // download runs as the hr_admin, where RLS also applies -- belt and braces).
  if (!(await companyMeetsPrivacyFloor(supabase, companyId))) {
    return {
      companyName,
      generatedAt,
      suppressed: true,
      supportCount: 0,
      reviewCompletions: [],
      weeklyParticipation: [],
      weekdayEngagement: [],
      trend: "not_enough_data",
    };
  }

  const [supportCount, reviewCompletions, weeklyParticipation, weekdayEngagement] = await Promise.all([
    getSupportCount(supabase, companyId),
    getReviewCompletions(supabase, companyId),
    getWeeklyParticipation(supabase, companyId),
    getWeekdayEngagement(supabase, companyId),
  ]);

  return {
    companyName,
    generatedAt,
    suppressed: false,
    supportCount,
    reviewCompletions,
    weeklyParticipation,
    weekdayEngagement,
    trend: computeOverallTrend(weeklyParticipation),
  };
}
