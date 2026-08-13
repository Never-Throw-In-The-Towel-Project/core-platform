// Pure feed-sorting helpers -- no DB access and no "server-only", so they are
// unit-testable in isolation (see sort.test.ts). getPosts fetches a recent
// candidate window and ranks it with these in application code rather than
// ordering by an aggregate in the DB -- the same "provably correct by reading,
// no untested PostgREST aggregate/embed syntax" stance as the rest of
// lib/community/queries.ts.

export type FeedSort = "new" | "top" | "hot";

const SORTS: readonly FeedSort[] = ["new", "top", "hot"];

/** Narrow an arbitrary query-string value to a FeedSort, defaulting to "new". */
export function parseFeedSort(value: string | undefined): FeedSort {
  return SORTS.includes(value as FeedSort) ? (value as FeedSort) : "new";
}

/**
 * "Hot" = a recency-weighted popularity score: a gentle gravity decay so a
 * newer post outranks an equally-liked older one, and the `+ 1` keeps recency
 * meaningful even before a post has any likes (an unliked feed then sorts like
 * "new"). Pure: `createdAtMs`/`nowMs` are epoch milliseconds, so it's
 * deterministic and testable. Never negative (age is clamped at 0).
 */
export function hotScore(likeCount: number, createdAtMs: number, nowMs: number): number {
  const ageHours = Math.max(0, (nowMs - createdAtMs) / 3_600_000);
  return (likeCount + 1) / Math.pow(ageHours + 2, 1.5);
}

/**
 * Order a fetched post window by the chosen key. Never mutates the input.
 *  - new: newest first
 *  - top: most likes first (ties broken by newest)
 *  - hot: recency-weighted popularity (ties broken by newest)
 */
export function sortPosts<T extends { likeCount: number; created_at: string }>(
  posts: readonly T[],
  sort: FeedSort,
  nowMs: number
): T[] {
  const newest = (a: T, b: T) => Date.parse(b.created_at) - Date.parse(a.created_at);
  const copy = [...posts];
  if (sort === "top") {
    return copy.sort((a, b) => b.likeCount - a.likeCount || newest(a, b));
  }
  if (sort === "hot") {
    return copy.sort(
      (a, b) =>
        hotScore(b.likeCount, Date.parse(b.created_at), nowMs) -
          hotScore(a.likeCount, Date.parse(a.created_at), nowMs) || newest(a, b)
    );
  }
  return copy.sort(newest);
}
