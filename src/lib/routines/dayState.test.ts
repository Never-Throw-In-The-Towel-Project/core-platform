import { describe, it, expect, vi } from "vitest";

// dayState.ts is server-only and imports the Supabase server client (which
// pulls in next/headers). resolveHomePhase itself is pure, so stub both out of
// the way -- same approach as brain.test.ts.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { resolveHomePhase } = await import("./dayState");

// resolveHomePhase is pure (now, timeZone) -> phase. These fix the Saturday
// anchor added for the Weekly Review (Saturday is the day's focus all day,
// openable Fri-Sun) while proving Sunday and the Mon-Fri weekdays keep their
// existing time-of-day behaviour. All dates below are real: 2026-11-07 is a
// Saturday, -08 a Sunday, -10 a Tuesday; times are UTC and the zone is UTC.
describe("resolveHomePhase", () => {
  it("anchors the whole of Saturday to the Weekly Review, at every hour", () => {
    for (const hour of ["06", "11", "14", "19", "23"]) {
      const phase = resolveHomePhase(new Date(`2026-11-07T${hour}:00:00Z`), "UTC");
      expect(phase).toEqual({ kind: "weekly_review" });
    }
  });

  it("keeps Sunday on the morning/weekend-midday/night cadence", () => {
    expect(resolveHomePhase(new Date("2026-11-08T08:00:00Z"), "UTC")).toEqual({ kind: "morning" });
    expect(resolveHomePhase(new Date("2026-11-08T14:00:00Z"), "UTC")).toEqual({
      kind: "weekend_midday",
      isSunday: true,
    });
    expect(resolveHomePhase(new Date("2026-11-08T21:00:00Z"), "UTC")).toEqual({ kind: "night" });
  });

  it("keeps a Mon-Fri weekday on morning/themed/night", () => {
    // Tuesday 2026-11-10.
    expect(resolveHomePhase(new Date("2026-11-10T08:00:00Z"), "UTC")).toEqual({ kind: "morning" });
    expect(resolveHomePhase(new Date("2026-11-10T14:00:00Z"), "UTC")).toEqual({
      kind: "themed",
      weekday: "tuesday",
    });
    expect(resolveHomePhase(new Date("2026-11-10T21:00:00Z"), "UTC")).toEqual({ kind: "night" });
  });
});
