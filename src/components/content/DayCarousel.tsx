import Link from "next/link";
import type { ContentItem, ContentType } from "@/types/database";

const TYPE_LABEL: Record<ContentType, string> = {
  video: "Watch",
  document: "Read",
  image: "View",
};

/**
 * The day-of-week carousel -- a horizontal bank of content tagged for today's
 * weekday, rotated so a different item leads each real ISO week (see
 * lib/content/rotation.ts). Renders nothing when there's no content for the
 * day, so it never leaves an empty slot. Presentational: the caller does the
 * query, rotation, and channel scoping (via RLS).
 */
export function DayCarousel({ dayLabel, items }: { dayLabel: string; items: ContentItem[] }) {
  if (items.length === 0) return null;

  return (
    <section aria-label={`${dayLabel} picks`} className="border-b border-rule-hairline pb-8">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-deep">{dayLabel}</p>
      <h2 className="mt-1 text-xl font-extrabold tracking-tight">This week’s {dayLabel} picks</h2>

      {/* Wide row scrolls inside its own container so the page body never scrolls sideways. */}
      <ul className="mt-4 flex gap-4 overflow-x-auto pb-1">
        {items.map((item, i) => (
          <li key={item.id} className="shrink-0">
            <Link
              href={`/content/${item.id}`}
              className="block w-60 border border-rule-border p-3 transition-colors hover:bg-foreground/[0.03]"
            >
              <div className="flex h-28 w-full items-center justify-center border border-rule-border bg-foreground/[0.04] text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                {i === 0 ? "This week’s pick" : TYPE_LABEL[item.type]}
              </div>
              <p className="mt-3 line-clamp-2 font-extrabold leading-tight tracking-tight">{item.title}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                {TYPE_LABEL[item.type]}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
