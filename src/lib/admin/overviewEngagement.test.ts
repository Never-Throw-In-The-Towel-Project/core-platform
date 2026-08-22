import { describe, it, expect } from "vitest";
import {
  summarizeEngagement,
  type CompanyEngagement,
  type ParticipationTrend,
} from "./overviewEngagementSummary";

function company(o: {
  id: string;
  name: string;
  hasData?: boolean;
  participation?: number | null;
  trend?: ParticipationTrend;
  trendPoints?: number | null;
  reviewCompleted?: number;
  reviewEligible?: number;
  support?: number;
  headcount?: number;
}): CompanyEngagement {
  return {
    companyId: o.id,
    name: o.name,
    hasData: o.hasData ?? true,
    latestWeekNumber: o.hasData === false ? null : 8,
    latestParticipationPercent: o.participation ?? null,
    trend: o.trend ?? "not_enough_data",
    trendPoints: o.trendPoints ?? null,
    headcount: o.headcount ?? 0,
    reviewCompleted: o.reviewCompleted ?? 0,
    reviewEligible: o.reviewEligible ?? 0,
    supportCount: o.support ?? 0,
  };
}

const ROWS: CompanyEngagement[] = [
  company({ id: "a", name: "Alpha", participation: 72, trend: "rising", trendPoints: 9, reviewCompleted: 10, reviewEligible: 12, support: 3 }),
  company({ id: "b", name: "Bravo", participation: 55, trend: "steady", trendPoints: 1, reviewCompleted: 4, reviewEligible: 10, support: 1 }),
  company({ id: "c", name: "Charlie", participation: 80, trend: "falling", trendPoints: -6, reviewCompleted: 2, reviewEligible: 6 }),
  company({ id: "d", name: "Delta", hasData: false }),
];

describe("summarizeEngagement", () => {
  const s = summarizeEngagement(ROWS);

  it("orders with-data tenants by participation desc, no-data last", () => {
    expect(s.companies.map((c) => c.name)).toEqual(["Charlie", "Alpha", "Bravo", "Delta"]);
  });

  it("counts tenants with data", () => {
    expect(s.companiesWithData).toBe(3);
  });

  it("averages latest participation across with-data tenants only", () => {
    // round((80 + 72 + 55) / 3) = 69
    expect(s.avgParticipationPercent).toBe(69);
  });

  it("sums reviews platform-wide and derives the rate", () => {
    expect(s.reviewCompleted).toBe(16);
    expect(s.reviewEligible).toBe(28);
    expect(s.reviewRate).toBe(57); // round(16/28*100)
  });

  it("totals support and tallies trend directions", () => {
    expect(s.supportTotal).toBe(4);
    expect(s.trendTally).toEqual({ rising: 1, steady: 1, falling: 1 });
  });

  it("empty input degrades cleanly", () => {
    const e = summarizeEngagement([]);
    expect(e.companies).toEqual([]);
    expect(e.companiesWithData).toBe(0);
    expect(e.avgParticipationPercent).toBeNull();
    expect(e.reviewRate).toBeNull();
    expect(e.trendTally).toEqual({ rising: 0, steady: 0, falling: 0 });
  });
});
