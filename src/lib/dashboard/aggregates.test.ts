import { describe, expect, it, vi } from "vitest";
import { computeOverallTrend, type WeeklyParticipation } from "./aggregates";

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
    ...overrides,
  };
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
