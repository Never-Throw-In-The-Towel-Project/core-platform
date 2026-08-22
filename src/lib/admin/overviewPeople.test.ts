import { describe, it, expect } from "vitest";
import { summarizePeople, type CompanyRow, type PeopleProfileRow } from "./overviewPeopleSummary";
import type { UserRole } from "@/types/database";

const NOW = Date.parse("2026-08-22T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

function row(o: {
  company_id: string;
  role?: UserRole;
  createdDaysAgo: number;
  onboarded?: boolean;
  community?: boolean;
  podcast?: boolean;
  lastSeenDaysAgo?: number | null;
}): PeopleProfileRow {
  return {
    company_id: o.company_id,
    role: o.role ?? "employee",
    created_at: daysAgo(o.createdDaysAgo),
    onboarding_completed: o.onboarded ?? false,
    community_opt_in: o.community ?? false,
    podcast_guest_opt_in: o.podcast ?? false,
    last_seen_at: o.lastSeenDaysAgo == null ? null : daysAgo(o.lastSeenDaysAgo),
  };
}

const COMPANIES: CompanyRow[] = [
  { id: "A", name: "Alpha" },
  { id: "B", name: "Bravo" },
  { id: "C", name: "Empty Co" },
];

const PROFILES: PeopleProfileRow[] = [
  row({ company_id: "A", role: "employee", createdDaysAgo: 3, onboarded: true, community: true, lastSeenDaysAgo: 0.1 }),
  row({ company_id: "A", role: "employee", createdDaysAgo: 40, onboarded: true, podcast: true, lastSeenDaysAgo: 10 }),
  row({ company_id: "B", role: "hr_admin", createdDaysAgo: 10, onboarded: false, lastSeenDaysAgo: 3 }),
  row({ company_id: "A", role: "ntitt_admin", createdDaysAgo: 100, onboarded: true, community: true, lastSeenDaysAgo: null }),
];

describe("summarizePeople", () => {
  const s = summarizePeople(PROFILES, COMPANIES, NOW);

  it("totals and role breakdown", () => {
    expect(s.total).toBe(4);
    expect(Object.fromEntries(s.byRole.map((r) => [r.role, r.count]))).toEqual({
      employee: 2,
      hr_admin: 1,
      ntitt_admin: 1,
    });
    expect(s.employees).toBe(2);
  });

  it("new-user windows", () => {
    expect(s.newLast7d).toBe(1); // only the 3-day-old signup
    expect(s.newLast30d).toBe(2); // 3-day + 10-day
  });

  it("new-by-week is 8 buckets oldest→newest and only counts the last 8 weeks", () => {
    expect(s.newByWeek).toHaveLength(8);
    // newest bucket (index 7) holds the 3-day-old signup
    expect(s.newByWeek[7].count).toBe(1);
    // the 100-day-old signup is older than 8 weeks, so it's excluded
    const summed = s.newByWeek.reduce((n, w) => n + w.count, 0);
    expect(summed).toBe(3);
  });

  it("onboarding + opt-ins", () => {
    expect(s.onboardedCount).toBe(3);
    expect(s.onboardingRate).toBeCloseTo(0.75, 5);
    expect(s.communityOptIn).toBe(2);
    expect(s.podcastOptIn).toBe(1);
  });

  it("active-user windows from last_seen_at", () => {
    expect(s.activeToday).toBe(1); // seen 0.1 days ago
    expect(s.active7d).toBe(2); // 0.1d + 3d
    expect(s.active30d).toBe(3); // + 10d; the null-last_seen admin is excluded
    expect(s.everSeen).toBe(3);
  });

  it("per-company headcount includes empty tenants, sorted by size", () => {
    expect(s.perCompany.map((c) => c.name)).toEqual(["Alpha", "Bravo", "Empty Co"]);
    expect(s.perCompany[0]).toEqual({ companyId: "A", name: "Alpha", members: 3, onboarded: 3 });
    expect(s.perCompany[1]).toEqual({ companyId: "B", name: "Bravo", members: 1, onboarded: 0 });
    expect(s.perCompany[2]).toEqual({ companyId: "C", name: "Empty Co", members: 0, onboarded: 0 });
  });

  it("empty input is safe", () => {
    const e = summarizePeople([], [], NOW);
    expect(e.total).toBe(0);
    expect(e.onboardingRate).toBe(0);
    expect(e.perCompany).toEqual([]);
    expect(e.byRole.every((r) => r.count === 0)).toBe(true);
  });
});
