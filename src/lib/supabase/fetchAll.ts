import "server-only";

// PostgREST caps every response at max_rows (1000, supabase/config.toml) and
// silently truncates to an HTTP 200 with no error. So any SELECT that returns a
// collection which is then counted / summed / iterated in JS must page through
// the whole result with `.range()` and hard-fail on error, rather than reduce a
// first-1000-rows slice into a wrong total (findings E6/E7).
//
// This is the same loop the aggregation crons already run inline
// (app/api/jobs/aggregate-participation, aggregate-step-challenges); extracted
// here so every at-risk read shares one audited implementation.
//
// `.order()` on a UNIQUE, stable column is REQUIRED in `makeQuery`: range paging
// without a total order can skip or duplicate rows across page boundaries. And
// `makeQuery` must build a FRESH query each call -- a PostgREST query builder is
// single-use.
export const SUPABASE_MAX_ROWS = 1000;

export type PageResult<T> = { data: T[] | null; error: { message?: string } | null };

export async function fetchAllRows<T>(
  makeQuery: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += SUPABASE_MAX_ROWS) {
    const { data, error } = await makeQuery(from, from + SUPABASE_MAX_ROWS - 1);
    if (error) throw new Error(error.message ?? "query failed");
    const rows = data ?? [];
    out.push(...rows);
    // A short page (including an empty one) means we've reached the end. A full
    // page means there may be more, so keep going.
    if (rows.length < SUPABASE_MAX_ROWS) break;
  }
  return out;
}
