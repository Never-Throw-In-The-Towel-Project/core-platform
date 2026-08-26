import type { ContentItem } from "@/types/database";
import { ContentCard } from "@/components/content/ContentCard";

/**
 * The day-of-week carousel -- a horizontal bank of content tagged for today's
 * weekday, rotated so a different item leads each real ISO week (see
 * lib/content/rotation.ts). Renders nothing when there's no content for the
 * day, so it never leaves an empty slot. Presentational: the caller does the
 * query, rotation, and channel scoping (via RLS). Uses the shared ContentCard so
 * the picks read consistently with the results grid below.
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
          <li key={item.id} className="w-64 shrink-0">
            <ContentCard item={item} badge={i === 0 ? "This week’s pick" : undefined} />
          </li>
        ))}
      </ul>
    </section>
  );
}
