import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
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
  const [supportCount, reviewCompletions, weeklyParticipation, weekdayEngagement] = await Promise.all([
    getSupportCount(supabase, companyId),
    getReviewCompletions(supabase, companyId),
    getWeeklyParticipation(supabase, companyId),
    getWeekdayEngagement(supabase, companyId),
  ]);

  return {
    companyName,
    generatedAt: todayISODate(),
    supportCount,
    reviewCompletions,
    weeklyParticipation,
    weekdayEngagement,
    trend: computeOverallTrend(weeklyParticipation),
  };
}
