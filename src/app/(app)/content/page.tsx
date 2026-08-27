import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listContentItems } from "@/lib/content/queries";
import { ContentCard } from "@/components/content/ContentCard";
import type { ContentItem, VideoCategory } from "@/types/database";

const CATEGORIES: { value: VideoCategory; label: string }[] = [
  { value: "mental_fitness", label: "Mental Fitness" },
  { value: "physical_fitness", label: "Physical Fitness" },
  { value: "nutrition", label: "Nutrition" },
  { value: "tools_tips", label: "Tools & Tips" },
];

const CATEGORY_LABEL: Record<VideoCategory, string> = {
  mental_fitness: "Mental Fitness",
  physical_fitness: "Physical Fitness",
  nutrition: "Nutrition",
  tools_tips: "Tools & Tips",
};

// The grid renders a page at a time (cumulative "Load more"), so a large
// library never floods a single response. 24 fills the 2/3-up grid evenly.
const PAGE_SIZE = 24;

/** Build a /content link, keeping the parts that should persist. `page` is
 *  only emitted past 1, so a fresh filter naturally starts at the first page. */
function contentHref(next: { q?: string; category?: string; page?: number }): string {
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.category) params.set("category", next.category);
  if (next.page && next.page > 1) params.set("page", String(next.page));
  const qs = params.toString();
  return qs ? `/content?${qs}` : "/content";
}

// Filter pill — active is a solid red fill, inactive an outlined chip; on the
// Library's ink surface the outline resolves to the ink hairline and the label
// to muted-on-ink (see the data-surface="ink" scope in globals.css).
const PILL_BASE =
  "block whitespace-nowrap border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] transition-colors";
const PILL_ACTIVE = "border-brand-accent bg-brand-accent text-brand-accent-foreground";
const PILL_INACTIVE = "border-rule-border text-muted hover:border-foreground hover:text-foreground";

/**
 * Content Library -- one shared library, built once, available to every
 * company (see docs/ARCHITECTURE.md "Core platform vs. co-branded portals").
 * Reads the content_items spine (docs/CONTENT_PLATFORM_STRATEGY.md), so it
 * shows videos, documents, and images; channel targeting is enforced by the
 * content_items RLS policy for the viewer's own session.
 *
 * The dark "content-OS" layout (Anthony's designers): a near-black board on the
 * shared data-surface="ink" scope. This slice is the shell -- hero with a live
 * synced count + search, the category filter, and the paginated all-content
 * grid. Curated shelves (Series, Under 3 minutes, Read & download) and the
 * topic/stage facets land in follow-up slices.
 */
export default async function ContentLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const { q, category, page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  // Wrapped in try/catch: createClient() throws synchronously if the URL/key
  // are missing or malformed. Degrading to an empty result is the same "Nothing
  // here yet" state this page already renders for a genuinely empty library.
  let items: ContentItem[] = [];
  let total = 0;
  try {
    const supabase = await createClient();
    const result = await listContentItems(supabase, { q, category, limit: PAGE_SIZE * page });
    items = result.items;
    total = result.total;
  } catch {
    items = [];
    total = 0;
  }

  const filtered = Boolean(q || category);
  const shown = items.length;
  const hasMore = shown < total;

  const eyebrow = q ? "Search" : category ? "Category" : "Everything else";
  const heading = q
    ? `“${q}”`
    : category && CATEGORY_LABEL[category as VideoCategory]
      ? CATEGORY_LABEL[category as VideoCategory]
      : "All content";

  return (
    <main data-surface="ink" className="min-h-full bg-background text-foreground">
      {/* Hero: identity + the live synced count on the left, search on the
          right. Collapses to a single column on mobile. */}
      <section className="border-b-2 border-brand-accent">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-accent-light-2">
              The Library
            </p>
            <h1 className="mt-3 max-w-2xl text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
              Every video, in the order you need it.
            </h1>
          </div>

          <div className="lg:w-[22rem]">
            <p className="text-sm leading-relaxed text-muted-on-ink-2">
              {total > 0 ? `${total.toLocaleString("en-GB")} pieces of content, ` : ""}synced from your Vimeo
              library — search a topic and go straight there.
            </p>
            <form className="mt-4 flex gap-2" action="/content" role="search">
              <label htmlFor="content-search" className="sr-only">
                Search content by topic
              </label>
              <input
                id="content-search"
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search titles, topics, series…"
                className="min-w-0 flex-1 border-2 border-brand-foreground bg-transparent px-4 py-3 text-brand-foreground placeholder:text-muted-on-ink"
              />
              {category && <input type="hidden" name="category" value={category} />}
              <button
                type="submit"
                className="shrink-0 bg-brand-accent px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground transition-opacity hover:opacity-90"
              >
                Search
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Category filter row. The topic and "where you are" facets from the
          design join this rail once the taxonomy is real (follow-up slice). */}
      <nav className="border-b border-rule-hairline" aria-label="Filter by category">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-3 px-6 py-4">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted">Category</span>
          <div className="flex flex-wrap gap-2">
            <Link
              href={contentHref({ q })}
              aria-current={!category ? "page" : undefined}
              className={`${PILL_BASE} ${!category ? PILL_ACTIVE : PILL_INACTIVE}`}
            >
              All
            </Link>
            {CATEGORIES.map((cat) => {
              const active = category === cat.value;
              return (
                <Link
                  key={cat.value}
                  href={contentHref({ q, category: cat.value })}
                  aria-current={active ? "page" : undefined}
                  className={`${PILL_BASE} ${active ? PILL_ACTIVE : PILL_INACTIVE}`}
                >
                  {cat.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* All content grid. */}
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-light-2">
              {eyebrow}
            </p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight">{heading}</h2>
          </div>
          <div className="flex shrink-0 items-baseline gap-4">
            {total > 0 && (
              <span className="text-xs font-semibold text-muted">
                {shown.toLocaleString("en-GB")} of {total.toLocaleString("en-GB")} shown
              </span>
            )}
            {filtered && (
              <Link href="/content" className="text-xs font-extrabold uppercase tracking-wide text-brand-accent-light">
                Clear
              </Link>
            )}
          </div>
        </div>
        <div className="mt-4 border-t border-rule-hairline" />

        {shown === 0 ? (
          <div className="py-20 text-center">
            <p className="text-xl font-extrabold tracking-tight">
              {filtered ? "No matches here." : "Nothing here yet."}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              {filtered
                ? "Try a different topic or clear the filters — new content lands here as it’s published."
                : "Check back soon — new content lands here as it’s published."}
            </p>
            {filtered && (
              <Link
                href="/content"
                className="mt-6 inline-block border-2 border-foreground px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide transition-colors hover:bg-foreground hover:text-background"
              >
                Browse everything
              </Link>
            )}
          </div>
        ) : (
          <>
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <li key={item.id}>
                  <ContentCard item={item} />
                </li>
              ))}
            </ul>

            {hasMore && (
              <div className="mt-10 flex justify-center">
                <Link
                  href={contentHref({ q, category, page: page + 1 })}
                  scroll={false}
                  className="border-2 border-foreground px-6 py-3 text-sm font-extrabold uppercase tracking-wide transition-colors hover:bg-foreground hover:text-background"
                >
                  Load more
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
