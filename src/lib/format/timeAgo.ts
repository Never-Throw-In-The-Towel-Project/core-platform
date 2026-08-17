/**
 * Compact relative time for social feeds -- "just now", "5m", "3h", "2d" --
 * falling back to an absolute date after a week. Deterministic given `now`
 * (pass the same server-computed `now` to every card so SSR and hydration agree,
 * avoiding a relative-time hydration mismatch).
 */
export function timeAgo(iso: string, now: Date): string {
  const then = new Date(iso).getTime();
  const sec = Math.max(0, Math.round((now.getTime() - then) / 1000));
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
