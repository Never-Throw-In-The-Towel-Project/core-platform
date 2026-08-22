import type { UserRole } from "@/types/database";

/**
 * Pure shapes + arithmetic for the Admin Overview "People & tenants" section.
 * No `server-only`, no Supabase — the service-role fetch lives in
 * ./overviewPeople.ts and feeds these functions the rows. Unit-tested.
 *
 * Privacy: these operate on non-private profile columns only (identity + coarse
 * activity), never on any member's routine/check-in/review content.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const NEW_WEEKS = 8;

export const PEOPLE_ROLES: UserRole[] = ["employee", "hr_admin", "ntitt_admin"];

/** The non-private profile columns the overview reads. */
export interface PeopleProfileRow {
  company_id: string;
  role: UserRole;
  created_at: string;
  onboarding_completed: boolean;
  community_opt_in: boolean;
  podcast_guest_opt_in: boolean;
  last_seen_at: string | null;
}

export interface CompanyRow {
  id: string;
  name: string;
}

export interface CompanyHeadcount {
  companyId: string;
  name: string;
  members: number;
  onboarded: number;
}

export interface WeekBucket {
  /** ISO date (yyyy-mm-dd) of the bucket's start — the older edge. */
  weekStartIso: string;
  count: number;
}

export interface PeopleOverview {
  total: number;
  byRole: { role: UserRole; count: number }[];
  employees: number;
  newLast7d: number;
  newLast30d: number;
  /** Sign-ups per rolling 7-day bucket, oldest → newest (last 8 weeks). */
  newByWeek: WeekBucket[];
  onboardedCount: number;
  /** 0..1 — fraction of all users who finished onboarding. */
  onboardingRate: number;
  communityOptIn: number;
  podcastOptIn: number;
  activeToday: number;
  active7d: number;
  active30d: number;
  /** How many members have ever been seen since tracking began. */
  everSeen: number;
  /** All tenants, sorted by headcount desc (then name). */
  perCompany: CompanyHeadcount[];
}

export function emptyPeopleOverview(): PeopleOverview {
  return {
    total: 0,
    byRole: PEOPLE_ROLES.map((role) => ({ role, count: 0 })),
    employees: 0,
    newLast7d: 0,
    newLast30d: 0,
    newByWeek: [],
    onboardedCount: 0,
    onboardingRate: 0,
    communityOptIn: 0,
    podcastOptIn: 0,
    activeToday: 0,
    active7d: 0,
    active30d: 0,
    everSeen: 0,
    perCompany: [],
  };
}

const within = (iso: string | null, nowMs: number, windowMs: number): boolean => {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && nowMs - t <= windowMs;
};

/**
 * Roll up the profile rows into the People overview. `nowMs` is injected so the
 * time-windowed counts (new/active/by-week) are deterministic under test.
 */
export function summarizePeople(
  profiles: PeopleProfileRow[],
  companies: CompanyRow[],
  nowMs: number
): PeopleOverview {
  const byRole = PEOPLE_ROLES.map((role) => ({
    role,
    count: profiles.filter((p) => p.role === role).length,
  }));

  const onboardedCount = profiles.filter((p) => p.onboarding_completed).length;

  // Rolling 7-day sign-up buckets, oldest first. Bucket i (i = NEW_WEEKS-1 …0)
  // covers [now - (i+1)·week, now - i·week).
  const newByWeek: WeekBucket[] = [];
  for (let i = NEW_WEEKS - 1; i >= 0; i--) {
    const startMs = nowMs - (i + 1) * WEEK_MS;
    const endMs = nowMs - i * WEEK_MS;
    const count = profiles.filter((p) => {
      const t = Date.parse(p.created_at);
      return Number.isFinite(t) && t >= startMs && t < endMs;
    }).length;
    newByWeek.push({ weekStartIso: new Date(startMs).toISOString().slice(0, 10), count });
  }

  // Per-company headcount — seed from the full company roster so an empty tenant
  // still shows (0 members), then tally profiles onto it.
  const nameById = new Map(companies.map((c) => [c.id, c.name]));
  const acc = new Map<string, CompanyHeadcount>();
  for (const c of companies) {
    acc.set(c.id, { companyId: c.id, name: c.name, members: 0, onboarded: 0 });
  }
  for (const p of profiles) {
    let row = acc.get(p.company_id);
    if (!row) {
      row = { companyId: p.company_id, name: nameById.get(p.company_id) ?? "Unknown", members: 0, onboarded: 0 };
      acc.set(p.company_id, row);
    }
    row.members += 1;
    if (p.onboarding_completed) row.onboarded += 1;
  }
  const perCompany = [...acc.values()].sort((a, b) => b.members - a.members || a.name.localeCompare(b.name));

  return {
    total: profiles.length,
    byRole,
    employees: byRole.find((r) => r.role === "employee")?.count ?? 0,
    newLast7d: profiles.filter((p) => within(p.created_at, nowMs, WEEK_MS)).length,
    newLast30d: profiles.filter((p) => within(p.created_at, nowMs, 30 * DAY_MS)).length,
    newByWeek,
    onboardedCount,
    onboardingRate: profiles.length > 0 ? onboardedCount / profiles.length : 0,
    communityOptIn: profiles.filter((p) => p.community_opt_in).length,
    podcastOptIn: profiles.filter((p) => p.podcast_guest_opt_in).length,
    activeToday: profiles.filter((p) => within(p.last_seen_at, nowMs, DAY_MS)).length,
    active7d: profiles.filter((p) => within(p.last_seen_at, nowMs, WEEK_MS)).length,
    active30d: profiles.filter((p) => within(p.last_seen_at, nowMs, 30 * DAY_MS)).length,
    everSeen: profiles.filter((p) => p.last_seen_at != null).length,
    perCompany,
  };
}
