import Link from "next/link";
import type { ContentItem, ContentType } from "@/types/database";

/**
 * One content tile for the member Library — a poster-led card linking to the
 * watch/read page. Shared by the results grid and the day-picks row so the
 * library reads as one consistent surface. Video posters get a play affordance
 * and a duration badge; a text piece leads with its summary; anything without a
 * captured still falls back to an honest type-labelled frame.
 */

const TYPE_LABEL: Record<ContentType, string> = {
  video: "Watch",
  document: "Read",
  image: "View",
  text: "Read",
};

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  return `${Math.round(seconds / 60)} min`;
}

export function ContentCard({ item, badge }: { item: ContentItem; badge?: string }) {
  const duration = formatDuration(item.duration_seconds);
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
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] font-extrabold uppercase tracking-[0.2em] text-muted">
            {TYPE_LABEL[item.type]}
          </div>
        )}

        {item.type === "video" && hasPoster && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm transition-transform duration-200 group-hover:scale-110">
              <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        )}

        {badge && (
          <span className="absolute left-2 top-2 bg-brand-accent px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-foreground">
            {badge}
          </span>
        )}
        {duration && (
          <span className="absolute bottom-2 right-2 bg-foreground/80 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-background">
            {duration}
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-deep">
          {TYPE_LABEL[item.type]}
        </p>
        <p className="line-clamp-2 font-extrabold leading-tight tracking-tight">{item.title}</p>
        {item.type === "text" && item.summary && <p className="line-clamp-2 text-xs text-muted">{item.summary}</p>}
        {item.tags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1 pt-1">
            {item.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="border border-rule-hairline px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
