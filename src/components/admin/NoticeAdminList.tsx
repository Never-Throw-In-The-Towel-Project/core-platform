import type { NoticeView } from "@/lib/notices/queries";
import { NoticeItemActions } from "./NoticeItemActions";

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Mondays",
  2: "Tuesdays",
  3: "Wednesdays",
  4: "Thursdays",
  5: "Fridays",
  6: "Saturdays",
  7: "Sundays",
};

const MEDIA_LABELS: Record<NoticeView["media_kind"], string> = {
  none: "Text",
  vimeo: "Video",
  image: "Image",
  video: "Video file",
};

function fmtDate(iso: string): string {
  // A fixed yyyy-mm-dd string -> "5 Sep 2026". Deterministic (no clock read).
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** A one-line human summary of when a notice shows (weekday + date window). */
function scheduleSummary(n: NoticeView): string {
  const day = n.weekday != null ? WEEKDAY_LABELS[n.weekday] : null;
  let window: string | null = null;
  if (n.starts_on && n.ends_on) window = `${fmtDate(n.starts_on)} – ${fmtDate(n.ends_on)}`;
  else if (n.starts_on) window = `from ${fmtDate(n.starts_on)}`;
  else if (n.ends_on) window = `until ${fmtDate(n.ends_on)}`;

  if (day && window) return `${day} · ${window}`;
  if (day) return day;
  if (window) return `Every day · ${window}`;
  return "Every day";
}

/**
 * The Studio's list of every notice (drafts included, via RLS). Each row shows a
 * thumbnail or media chip, the headline, its schedule + published state, and the
 * per-notice controls. Priority-ordered by the query.
 */
export function NoticeAdminList({ notices }: { notices: NoticeView[] }) {
  if (notices.length === 0) {
    return <p className="mt-4 text-sm text-muted">Nothing yet — create your first above.</p>;
  }

  return (
    <ul className="mt-4 space-y-2">
      {notices.map((n) => (
        <li key={n.id} className="flex items-stretch gap-4 border border-rule-border p-3">
          {n.media_kind === "image" && n.image_url ? (
            <div className="h-16 w-16 shrink-0 overflow-hidden border border-rule-hairline bg-brand-background">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote Storage asset, not a local/optimizable image */}
              <img src={n.image_url} alt="" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center border border-rule-hairline bg-background text-center">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-brand-accent-deep">
                {MEDIA_LABELS[n.media_kind]}
              </span>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
            <div className="flex items-start justify-between gap-3">
              <h4 className="min-w-0 truncate font-extrabold leading-tight tracking-tight">{n.title}</h4>
              <span
                className={
                  "shrink-0 border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] " +
                  (n.is_published
                    ? "border-foreground text-foreground"
                    : "border-rule-border text-muted")
                }
              >
                {n.is_published ? "Live" : "Draft"}
              </span>
            </div>
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted">
              {scheduleSummary(n)}
              {n.priority > 0 ? ` · priority ${n.priority}` : ""}
            </p>
            <div className="mt-1">
              <NoticeItemActions id={n.id} isPublished={n.is_published} title={n.title} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
