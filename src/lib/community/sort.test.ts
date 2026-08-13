import { describe, it, expect } from "vitest";
import { parseFeedSort, hotScore, sortPosts, type FeedSort } from "./sort";

// Fixed clock so "hot"/"new" are deterministic. Posts carry only the fields
// sortPosts reads.
const NOW = Date.parse("2026-08-13T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

function post(id: string, likeCount: number, ageHours: number) {
  return { id, likeCount, created_at: hoursAgo(ageHours) };
}

const ids = (list: { id: string }[]) => list.map((p) => p.id);

describe("parseFeedSort", () => {
  it("accepts the three known sorts", () => {
    (["new", "top", "hot"] as FeedSort[]).forEach((s) => expect(parseFeedSort(s)).toBe(s));
  });
  it("defaults anything else (undefined, junk) to 'new'", () => {
    expect(parseFeedSort(undefined)).toBe("new");
    expect(parseFeedSort("")).toBe("new");
    expect(parseFeedSort("popular")).toBe("new");
  });
});

describe("hotScore", () => {
  it("is higher for a newer post at equal likes", () => {
    expect(hotScore(5, NOW - 1 * 3_600_000, NOW)).toBeGreaterThan(hotScore(5, NOW - 10 * 3_600_000, NOW));
  });
  it("is higher for a more-liked post at equal age", () => {
    const t = NOW - 5 * 3_600_000;
    expect(hotScore(10, t, NOW)).toBeGreaterThan(hotScore(2, t, NOW));
  });
  it("stays positive with zero likes (recency still ranks)", () => {
    expect(hotScore(0, NOW - 3 * 3_600_000, NOW)).toBeGreaterThan(0);
  });
});

describe("sortPosts", () => {
  it("new: newest first regardless of likes", () => {
    const posts = [post("old", 100, 48), post("mid", 0, 5), post("fresh", 1, 1)];
    expect(ids(sortPosts(posts, "new", NOW))).toEqual(["fresh", "mid", "old"]);
  });

  it("top: most likes first, ties broken by newest", () => {
    const posts = [post("a", 3, 10), post("b", 9, 30), post("c", 9, 2)];
    // b and c both have 9 likes -> newer (c) leads
    expect(ids(sortPosts(posts, "top", NOW))).toEqual(["c", "b", "a"]);
  });

  it("hot: blends likes and recency (a fresh-but-unliked post can beat an old popular one)", () => {
    const oldPopular = post("oldPopular", 8, 240); // 10 days old
    const freshQuiet = post("freshQuiet", 0, 1);
    expect(ids(sortPosts([oldPopular, freshQuiet], "hot", NOW))).toEqual(["freshQuiet", "oldPopular"]);
  });

  it("does not mutate the input array", () => {
    const posts = [post("a", 1, 1), post("b", 2, 2)];
    const before = ids(posts);
    sortPosts(posts, "top", NOW);
    expect(ids(posts)).toEqual(before);
  });
});
