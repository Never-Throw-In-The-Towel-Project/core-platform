/**
 * PostgREST's .or()/.ilike() filter strings use commas and parentheses as
 * delimiters -- an unescaped value containing either (or a literal double
 * quote) could inject an extra filter condition instead of just being
 * matched against. Wrapping a value in double quotes, with any literal
 * quote escaped first, is PostgREST's documented mechanism for a filter
 * value containing reserved characters. Found and fixed as a real
 * vulnerability during the post-Phase 5 codebase review (both call sites
 * interpolated external input into a .or() filter unescaped) -- see
 * docs/ARCHITECTURE.md "Full codebase review (post-Phase 5)".
 *
 * This only escapes the value itself; callers are still responsible for
 * wrapping it in double quotes at each use site (e.g. `title.ilike."%${escapeFilterValue(q)}%"`),
 * since the surrounding quote placement differs per filter operator.
 */
export function escapeFilterValue(value: string): string {
  return value.replace(/"/g, '\\"');
}
