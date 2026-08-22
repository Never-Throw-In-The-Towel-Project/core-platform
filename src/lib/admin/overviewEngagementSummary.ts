import type { ParticipationTrend } from "@/lib/dashboard/aggregates";

/**
 * Pure shapes + assembly for the Admin Overview "Company engagement" section.
 * No `server-only`, no Supabase — the service-role gatherer (overviewEngagement.ts)
 * computes each company's numbers with the existing, tested aggregate helpers and
 * hands the per-company array here for platform-level roll-up. Unit-tested.
 *
 * Privacy: every field originates from the already-anonymised `company_*`
 * aggregate tables (the same ones an HR admin sees for their OWN company) —
 * counts and percentages, never an individual's routine/check-in/review data.
 */

export type { ParticipationTrend } from "@/lib/dashboard/aggregates";

/** One tenant's engagement, from its anonymised participation/review/support
 *  aggregates. `hasData` is false for a company the aggregation cron hasn't
 *  produced any participation weeks for yet (new/empty tenant). */
export interface CompanyEngagement {
  companyId: string;
  name: string;
  hasData: boolean;
  /** 1-based position of the latest week in the company's own history. */
  latestWeekNumber: number | null;
  /** Latest week's overall completion % (avg of morning/night/themed). */
  latestParticipationPercent: number | null;
  trend: ParticipationTrend;
  /** Signed point change across the weeks shown (from computeTrendDelta). */
  trendPoints: number | null;
  /** Latest week's enrolled headcount (a single-day snapshot, not a sum). */
  headcount: number;
  reviewCompleted: number;
  reviewEligible: number;
  supportCount: number;
}

export interface EngagementOverview {
  /** All tenants, with-data first, then by latest participation % desc. */
  companies: CompanyEngagement[];
  companiesWithData: number;
  /** Simple average of latest participation % across with-data tenants. */
  avgParticipationPercent: number | null;
  reviewCompleted: number;
  reviewEligible: number;
  /** Platform review-completion rate (0..100), or null if nothing eligible. */
  reviewRate: number | null;
  supportTotal: number;
  trendTally: { rising: number; steady: number; falling: number };
}

export function emptyEngagementOverview(): EngagementOverview {
  return {
    companies: [],
    companiesWithData: 0,
    avgParticipationPercent: null,
    reviewCompleted: 0,
    reviewEligible: 0,
    reviewRate: null,
    supportTotal: 0,
    trendTally: { rising: 0, steady: 0, falling: 0 },
  };
}

/**
 * Roll the per-company engagement rows up into the platform overview: order the
 * table (with-data tenants first, then by latest participation, then name) and
 * compute the platform sums / average / trend tally.
 */
export function summarizeEngagement(rows: CompanyEngagement[]): EngagementOverview {
  const companies = [...rows].sort((a, b) => {
    if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;
    const ap = a.latestParticipationPercent ?? -1;
    const bp = b.latestParticipationPercent ?? -1;
    if (ap !== bp) return bp - ap;
    return a.name.localeCompare(b.name);
  });

  const withData = companies.filter((c) => c.hasData);
  const participationValues = withData
    .map((c) => c.latestParticipationPercent)
    .filter((v): v is number => v !== null);

  const reviewCompleted = companies.reduce((n, c) => n + c.reviewCompleted, 0);
  const reviewEligible = companies.reduce((n, c) => n + c.reviewEligible, 0);

  const trendTally = { rising: 0, steady: 0, falling: 0 };
  for (const c of companies) {
    if (c.trend === "rising") trendTally.rising += 1;
    else if (c.trend === "falling") trendTally.falling += 1;
    else if (c.trend === "steady") trendTally.steady += 1;
  }

  return {
    companies,
    companiesWithData: withData.length,
    avgParticipationPercent:
      participationValues.length > 0
        ? Math.round(participationValues.reduce((s, v) => s + v, 0) / participationValues.length)
        : null,
    reviewCompleted,
    reviewEligible,
    reviewRate: reviewEligible > 0 ? Math.round((reviewCompleted / reviewEligible) * 100) : null,
    supportTotal: companies.reduce((n, c) => n + c.supportCount, 0),
    trendTally,
  };
}
