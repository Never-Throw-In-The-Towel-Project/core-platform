import Link from "next/link";
import { ContentCard } from "@/components/content/ContentCard";
import type { ContentItem, ContentType } from "@/types/database";

/**
 * A Library "shelf": an editorial row from the dark content-OS design — an
 * eyebrow + title + description, an optional "See all" link, a large
 * red-bordered anchor card, and a horizontally-scrolling strip of the rest.
 * Server component (no hooks); the page passes already-fetched items. On the
 * Library's data-surface="ink" scope every token resolves to the ink palette.
 */
export function Shelf({
  eyebrow,
  title,
  description,
  seeAllHref,
  seeAllLabel,
  items,
}: {
  eyebrow: string;
  title: string;
  description?: string | null;
  seeAllHref?: string;
  seeAllLabel?: string;
  items: ContentItem[];
}) {
  if (items.length === 0) return null;
  const [anchor, ...strip] = items;

  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-light-2">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight">
            {title}
            {description && (
              <span className="ml-3 align-middle text-sm font-normal text-muted">{description}</span>
            )}
          </h2>
        </div>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="shrink-0 text-[11px] font-extrabold uppercase tracking-wide text-brand-accent-light hover:text-brand-accent-light-2"
          >
            {seeAllLabel ?? "See all"}
          </Link>
        )}
      </div>

      <div className="mt-3 border-t border-brand-accent" />

      <div className="mt-5 grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <ShelfAnchor item={anchor} />
        {strip.length > 0 && (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {strip.map((item) => (
              <div key={item.id} className="w-52 shrink-0 sm:w-56">
                <ContentCard item={item} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const TYPE_LABEL: Record<ContentType, string> = {
  video: "Watch",
  document: "Download",
  image: "View",
  text: "Read",
};

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  return `${Math.round(seconds / 60)} min`;
}

/**
 * The large red-bordered lead card of a shelf: the poster dimmed behind a big
 * title, a type chip and duration at the foot. Links to the item's watch/read
 * page, like every other card.
 */
function ShelfAnchor({ item }: { item: ContentItem }) {
  const duration = formatDuration(item.duration_seconds);
  const label = TYPE_LABEL[item.type];

  return (
    <Link
      href={`/content/${item.id}`}
      className="group relative flex min-h-[18rem] flex-col justify-between overflow-hidden border-2 border-brand-accent bg-background p-5"
    >
      {item.thumbnail_url && (
        // eslint-disable-next-line @next/next/no-img-element -- remote poster URL, not a local/optimizable asset
        <img
          src={item.thumbnail_url}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-30 transition-opacity duration-300 group-hover:opacity-40"
        />
      )}
      <div className="relative">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-light-2">{label}</p>
        <h3 className="mt-2 text-3xl font-extrabold leading-[0.95] tracking-tight">{item.title}</h3>
      </div>
      <div className="relative mt-auto flex items-center gap-3 pt-6">
        <span className="bg-brand-accent px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-brand-accent-foreground">
          {label}
        </span>
        {duration && <span className="text-xs font-semibold text-muted-on-ink-2">{duration}</span>}
      </div>
    </Link>
  );
}
