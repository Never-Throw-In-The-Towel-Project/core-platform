import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
// gatherEngagement doesn't call getPosts (getTodayStats does), but importing the
// module pulls the community queries in -- stub them so the test stays isolated.
vi.mock("@/lib/community/queries", () => ({ getPosts: vi.fn(async () => []) }));

type Dataset = {
  morning_entries: { entry_date: string }[];
  night_entries: { entry_date: string }[];
  step_entries: { entry_date: string; steps: number }[];
  themed_checkins: number; // head-count query
  community_posts: number; // head-count query
};
let dataset: Dataset;

// A PostgREST-shaped client: paged reads end in .range() (resolves to {data});
// head-count reads are awaited directly (the builder is thenable -> {count}).
function makeClient() {
  return {
    from: (table: keyof Dataset) => {
      const val = dataset[table];
      const builder: Record<string, unknown> = {};
      Object.assign(builder, {
        select: () => builder,
        eq: () => builder,
        not: () => builder,
        order: () => builder,
        range: (from: number, to: number) =>
          Promise.resolve({ data: Array.isArray(val) ? val.slice(from, to + 1) : [], error: null }),
        then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
          Promise.resolve({ count: typeof val === "number" ? val : 0, data: null, error: null }).then(onF, onR),
      });
      return builder;
    },
  };
}
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => makeClient()) }));

const { gatherEngagement } = await import("./todayStats");

beforeEach(() => {
  dataset = { morning_entries: [], night_entries: [], step_entries: [], themed_checkins: 0, community_posts: 0 };
});

describe("gatherEngagement (E6/E7 M2 -- active-day history must page past the 1000-row cap)", () => {
  it("counts every active day across >1000 daily rows, not a capped 1000", async () => {
    const DAYS = 1500;
    const base = Date.UTC(2021, 0, 1);
    dataset.morning_entries = Array.from({ length: DAYS }, (_, i) => ({
      entry_date: new Date(base + i * 86_400_000).toISOString().slice(0, 10),
    }));

    const eng = await gatherEngagement("u1");

    expect(eng.morningCount).toBe(1500);
    expect(eng.activeDayCount).toBe(1500);
    expect(eng.winsCount).toBe(1500); // morning + night(0) + themed(0)
  });

  it("derives best-ever step milestones from the full (paged) step history", async () => {
    const DAYS = 1200;
    const base = Date.UTC(2021, 0, 1);
    // Steps climb each day, so the single-day max sits well past row 1000; a
    // capped read would miss it.
    dataset.step_entries = Array.from({ length: DAYS }, (_, i) => ({
      entry_date: new Date(base + i * 86_400_000).toISOString().slice(0, 10),
      steps: 1000 + i,
    }));

    const eng = await gatherEngagement("u1");

    expect(eng.maxSingleDaySteps).toBe(1000 + (DAYS - 1)); // 2199, from row ~1199
  });

  it("still reads the head-count queries (themed/posts) and short reads normally", async () => {
    dataset.themed_checkins = 7;
    dataset.community_posts = 3;
    dataset.night_entries = [{ entry_date: "2026-01-01" }];

    const eng = await gatherEngagement("u1");

    expect(eng.themedCount).toBe(7);
    expect(eng.postCount).toBe(3);
    expect(eng.nightCount).toBe(1);
    expect(eng.winsCount).toBe(8); // 0 morning + 1 night + 7 themed
  });
});
