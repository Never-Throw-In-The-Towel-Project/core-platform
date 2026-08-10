import { describe, expect, it, vi } from "vitest";
import {
  computeOverallTrend,
  computeTrendDelta,
  getWeeklyParticipation,
  type WeeklyParticipation,
} from "./aggregates";

// aggregates.ts starts with `import "server-only"` -- that package throws
// under plain Node module resolution (it only resolves to a no-op under the
// "react-server" condition Next.js's build sets, which Vitest doesn't), so
// it needs stubbing out before the module can be imported at all here.
vi.mock("server-only", () => ({}));

function week(overrides: Partial<WeeklyParticipation> = {}): WeeklyParticipation {
  return {
    weekStartDate: "2026-01-05",
    weekNumber: 1,
    morningPercent: 50,
    nightPercent: 50,
    themedPercent: 50,
    headcount: 100,
    ...overrides,
  };
}

// Minimal stand-in for the supabase query builder getWeeklyParticipation
// uses: .from(...).select(...).eq(...).order(...) resolves to { data }.
type Row = {
  entry_date: string;
  segment: "morning" | "night" | "themed_checkin";
  completed_count: number;
  eligible_count: number;
};
function clientReturning(rows: Row[]) {
  const result = Promise.resolve({ data: rows });
  const chain = {
    from: () => chain,
    select: () => chain,
    eq: () => chain,
    order: () => result,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return chain as any;
}

describe("computeOverallTrend", () => {
  it("returns not_enough_data with fewer than 2 weeks", () => {
    expect(computeOverallTrend([])).toBe("not_enough_data");
    expect(computeOverallTrend([week()])).toBe("not_enough_data");
  });

  it("returns not_enough_data when the most recent week has no data at all", () => {
    const weeks = [
      week({ morningPercent: 60 }),
      week({ morningPercent: null, nightPercent: null, themedPercent: null }),
    ];
    expect(computeOverallTrend(weeks)).toBe("not_enough_data");
  });

  it("returns rising when the average climbs by more than 5 points", () => {
    const weeks = [
      week({ morningPercent: 50, nightPercent: 50, themedPercent: 50 }), // avg 50
      week({ morningPercent: 60, nightPercent: 60, themedPercent: 60 }), // avg 60, delta +10
    ];
    expect(computeOverallTrend(weeks)).toBe("rising");
  });

  it("returns falling when the average drops by more than 5 points", () => {
    const weeks = [
      week({ morningPercent: 60, nightPercent: 60, themedPercent: 60 }),
      week({ morningPercent: 50, nightPercent: 50, themedPercent: 50 }), // delta -10
    ];
    expect(computeOverallTrend(weeks)).toBe("falling");
  });

  it("returns steady within a +/-5 point band", () => {
    const weeks = [
      week({ morningPercent: 50, nightPercent: 50, themedPercent: 50 }),
      week({ morningPercent: 53, nightPercent: 53, themedPercent: 53 }), // delta +3
    ];
    expect(computeOverallTrend(weeks)).toBe("steady");
  });

  it("averages only the segments that have data, ignoring nulls", () => {
    const weeks = [
      week({ morningPercent: 40, nightPercent: null, themedPercent: 60 }), // avg 50
      week({ morningPercent: 70, nightPercent: null, themedPercent: 70 }), // avg 70, delta +20
    ];
    expect(computeOverallTrend(weeks)).toBe("rising");
  });

  it("only compares the two most recent weeks, ignoring older history", () => {
    const weeks = [
      week({ morningPercent: 90, nightPercent: 90, themedPercent: 90 }), // ignored
      week({ morningPercent: 50, nightPercent: 50, themedPercent: 50 }),
      week({ morningPercent: 53, nightPercent: 53, themedPercent: 53 }), // delta +3 from previous
    ];
    expect(computeOverallTrend(weeks)).toBe("steady");
  });
});

describe("getWeeklyParticipation", () => {
  // 3 morning check-ins across one Mon-Wed of the same week, each with a
  // headcount snapshot of 10 eligible employees. The regression this guards:
  // headcount must be a single day's figure (10), never the week's SUM (30).
  const rows: Row[] = [
    { entry_date: "2026-01-05", segment: "morning", completed_count: 8, eligible_count: 10 }, // Mon
    { entry_date: "2026-01-06", segment: "morning", completed_count: 9, eligible_count: 10 }, // Tue
    { entry_date: "2026-01-07", segment: "morning", completed_count: 7, eligible_count: 10 }, // Wed
  ];

  it("reports headcount as a single day's eligible count, not the week sum", async () => {
    const [wk] = await getWeeklyParticipation(clientReturning(rows), "company-1");
    expect(wk.headcount).toBe(10); // NOT 30
  });

  it("still computes the weekly completion % from summed completed/eligible", async () => {
    const [wk] = await getWeeklyParticipation(clientReturning(rows), "company-1");
    // (8 + 9 + 7) / (10 + 10 + 10) = 24/30 = 80%
    expect(wk.morningPercent).toBe(80);
  });

  it("uses the max eligible snapshot when headcount grows mid-week", async () => {
    const growing: Row[] = [
      { entry_date: "2026-01-05", segment: "morning", completed_count: 5, eligible_count: 10 },
      { entry_date: "2026-01-08", segment: "morning", completed_count: 6, eligible_count: 12 }, // 2 joined
    ];
    const [wk] = await getWeeklyParticipation(clientReturning(growing), "company-1");
    expect(wk.headcount).toBe(12);
  });
});

describe("computeTrendDelta", () => {
  it("returns null with fewer than 2 weeks", () => {
    expect(computeTrendDelta([])).toBeNull();
    expect(computeTrendDelta([week()])).toBeNull();
  });

  it("compares the latest week to the earliest in the given range, not a fixed lookback", () => {
    const weeks = [
      week({ weekNumber: 8, morningPercent: 60, nightPercent: 60, themedPercent: 60 }), // avg 60
      week({ weekNumber: 9, morningPercent: 65, nightPercent: 65, themedPercent: 65 }), // ignored (middle)
      week({ weekNumber: 12, morningPercent: 69, nightPercent: 69, themedPercent: 69 }), // avg 69, delta +9
    ];
    expect(computeTrendDelta(weeks)).toEqual({ points: 9, comparedToWeekNumber: 8 });
  });

  it("returns a negative delta when the rate has fallen", () => {
    const weeks = [
      week({ weekNumber: 1, morningPercent: 70, nightPercent: 70, themedPercent: 70 }),
      week({ weekNumber: 2, morningPercent: 55, nightPercent: 55, themedPercent: 55 }),
    ];
    expect(computeTrendDelta(weeks)).toEqual({ points: -15, comparedToWeekNumber: 1 });
  });

  it("returns null if either endpoint has no data at all", () => {
    const weeks = [
      week({ morningPercent: null, nightPercent: null, themedPercent: null }),
      week({ morningPercent: 60, nightPercent: 60, themedPercent: 60 }),
    ];
    expect(computeTrendDelta(weeks)).toBeNull();
  });
});
