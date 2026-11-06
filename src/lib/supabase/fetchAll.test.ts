import { describe, it, expect, vi } from "vitest";
import type { PageResult } from "./fetchAll";

vi.mock("server-only", () => ({}));

const { fetchAllRows, SUPABASE_MAX_ROWS } = await import("./fetchAll");

function makePager(total: number) {
  const calls: Array<[number, number]> = [];
  const all = Array.from({ length: total }, (_, i) => ({ i }));
  const makeQuery = (from: number, to: number): Promise<PageResult<{ i: number }>> => {
    calls.push([from, to]);
    return Promise.resolve({ data: all.slice(from, to + 1), error: null });
  };
  return { makeQuery, calls };
}

describe("fetchAllRows (E6/E7 -- page past the 1000-row cap, never aggregate a truncated slice)", () => {
  it("returns a single short page in one request", async () => {
    const { makeQuery, calls } = makePager(10);
    const rows = await fetchAllRows(makeQuery);
    expect(rows).toHaveLength(10);
    expect(calls).toEqual([[0, SUPABASE_MAX_ROWS - 1]]);
  });

  it("pages past the cap and concatenates every row in order", async () => {
    const total = SUPABASE_MAX_ROWS * 2 + 7;
    const { makeQuery, calls } = makePager(total);
    const rows = await fetchAllRows<{ i: number }>(makeQuery);
    expect(rows).toHaveLength(total);
    expect(rows[0].i).toBe(0);
    expect(rows[total - 1].i).toBe(total - 1);
    expect(calls).toEqual([
      [0, SUPABASE_MAX_ROWS - 1],
      [SUPABASE_MAX_ROWS, SUPABASE_MAX_ROWS * 2 - 1],
      [SUPABASE_MAX_ROWS * 2, SUPABASE_MAX_ROWS * 3 - 1],
    ]);
  });

  it("makes one extra empty request when the total is an exact multiple of the cap", async () => {
    const { makeQuery, calls } = makePager(SUPABASE_MAX_ROWS);
    const rows = await fetchAllRows(makeQuery);
    expect(rows).toHaveLength(SUPABASE_MAX_ROWS);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual([SUPABASE_MAX_ROWS, SUPABASE_MAX_ROWS * 2 - 1]);
  });

  it("throws on a query error rather than returning a partial set", async () => {
    const makeQuery = () => Promise.resolve({ data: null, error: { message: "boom" } });
    await expect(fetchAllRows(makeQuery)).rejects.toThrow("boom");
  });

  it("treats null data as an empty page and stops", async () => {
    const makeQuery = () => Promise.resolve<PageResult<unknown>>({ data: null, error: null });
    await expect(fetchAllRows(makeQuery)).resolves.toEqual([]);
  });
});
