import Link from "next/link";
import type { ResumeItem } from "@/lib/content/resumeQueries";

/**
 * The Library's "Pick up where you left off" row (the mockup's continue-watching
 * section). Leads the default browse view with the member's in-progress videos,
 * newest touched first — each a poster with a red progress bar and an "N min
 * left" label. Server component; the page passes the already-joined items
 * (lib/content/resumeQueries.ts). Renders nothing until there's progress, so the
 * Library is unchanged for a member who hasn't started anything. On the Library's
 * data-surface="ink" scope every token resolves to the ink palette.
 */
export function ResumeShelf({ items }: { items: ResumeItem[] }) {
  if (items.length === 0) return null;

  return (
    <section aria-label="Pick up where you left off">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-light-2">
        Continue watching
      </p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight">Pick up where you left off.</h2>
      <div className="mt-3 border-t border-brand-accent" />

      <ul className="mt-5 flex gap-4 overflow-x-auto pb-2">
        {items.map((resume) => (
          <li key={resume.item.id} className="w-64 shrink-0 sm:w-72">
            <ResumeCard resume={resume} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResumeCard({ resume }: { resume: ResumeItem }) {
  const { item, percent, minutesLeft } = resume;
  const hasPoster = Boolean(item.thumbnail_url);

  return (
    <Link
      href={`/content/${item.id}`}
      className="group flex h-full flex-col border border-rule-border transition-colors hover:border-foreground"
    >
      <div className="relative aspect-video w-full overflow-hidden border-b border-rule-border bg-foreground/[0.04]">
        {hasPoster ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote poster URL, not a local/optimizable asset
          <img
            src={item.thumbnail_url!}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] font-extrabold uppercase tracking-[0.2em] text-muted">
            Watch
          </div>
        )}

        {hasPoster && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm transition-transform duration-200 group-hover:scale-110">
              <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        )}

        {/* Progress bar pinned to the poster's bottom edge — a white track with
            a red fill at the watched fraction. Only when the duration is known. */}
        {percent != null && (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-foreground/25" aria-hidden="true">
            <span className="block h-full bg-brand-accent" style={{ width: `${percent}%` }} />
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-3">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-deep">
          {minutesLeft != null ? `${minutesLeft} min left` : "Resume"}
        </p>
        <p className="line-clamp-2 font-extrabold leading-tight tracking-tight">{item.title}</p>
      </div>
    </Link>
  );
}
