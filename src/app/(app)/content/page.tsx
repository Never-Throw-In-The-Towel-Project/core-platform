import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listContentItems, listLibrarySeries, type ContentFilter, type LibrarySeries } from "@/lib/content/queries";
import { listResumeItems, type ResumeItem } from "@/lib/content/resumeQueries";
import { listTopicsWithCounts } from "@/lib/content/topicQueries";
import { ContentCard } from "@/components/content/ContentCard";
import { Shelf } from "@/components/content/Shelf";
import { ResumeShelf } from "@/components/content/ResumeShelf";
import type { ContentItem, ContentTopicWithCount, VideoCategory } from "@/types/database";

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

const FILTERS: ContentFilter[] = ["short", "reads"];
const FILTER_META: Record<ContentFilter, { eyebrow: string; heading: string }> = {
  short: { eyebrow: "Under 3 minutes", heading: "Quick watches" },
  reads: { eyebrow: "Read & download", heading: "Worksheets & reads" },
};

// The grid renders a page at a time (cumulative "Load more"), so a large
// library never floods a single response. 24 fills the 2/3/4-up grid evenly.
const PAGE_SIZE = 24;

/** Build a /content link, keeping the parts that should persist. `page` is
 *  only emitted past 1, so a fresh filter naturally starts at the first page. */
function contentHref(next: {
  q?: string;
  category?: string;
  topic?: string;
  filter?: ContentFilter;
  page?: number;
}): string {
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.category) params.set("category", next.category);
  if (next.topic) params.set("topic", next.topic);
  if (next.filter) params.set("filter", next.filter);
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
 * shared data-surface="ink" scope. The default browse view leads with curated
 * shelves (Series, Under 3 minutes, Read & download) and the "Browse by topic"
 * rooms above the paginated all-content grid; a search / category / topic / shelf
 * filter collapses to the focused grid. Topics come from the AI-tagged taxonomy
 * (content_topics); the "where you are" stages land in a later slice.
 */
export default async function ContentLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; topic?: string; filter?: string; page?: string }>;
}) {
  const { q, category, topic: topicParam, filter: filterParam, page: pageParam } = await searchParams;
  const filter = FILTERS.find((f) => f === filterParam);
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  // Wrapped in try/catch: createClient() throws synchronously if the URL/key
  // are missing or malformed. Degrading to empty results is the same "Nothing
  // here yet" state this page already renders for a genuinely empty library.
  let items: ContentItem[] = [];
  let total = 0;
  let series: LibrarySeries[] = [];
  let shortItems: ContentItem[] = [];
  let readItems: ContentItem[] = [];
  let resumeItems: ResumeItem[] = [];
  let topics: ContentTopicWithCount[] = [];
  try {
    const supabase = await createClient();
    topics = await listTopicsWithCounts(supabase);
    const activeTopic = topicParam ? topics.find((t) => t.slug === topicParam) : undefined;
    const topicId = activeTopic?.id;
    const isFiltered = Boolean(q || category || filter || topicId);

    if (isFiltered) {
      const result = await listContentItems(supabase, {
        q,
        category,
        filter,
        topicId,
        limit: PAGE_SIZE * page,
      });
      items = result.items;
      total = result.total;
    } else {
      // The default browse view: the grid plus the curated shelves and the
      // member's resume row, fetched together. Each shelf renders nothing when
      // its bank is empty (resume renders nothing until there's progress).
      const [grid, seriesRes, shortRes, readsRes, resumeRes] = await Promise.all([
        listContentItems(supabase, { limit: PAGE_SIZE * page }),
        listLibrarySeries(supabase, { maxSeries: 2, maxItems: 10 }),
        listContentItems(supabase, { filter: "short", limit: 12 }),
        listContentItems(supabase, { filter: "reads", limit: 12 }),
        listResumeItems({ limit: 12 }),
      ]);
      items = grid.items;
      total = grid.total;
      series = seriesRes;
      shortItems = shortRes.items;
      readItems = readsRes.items;
      resumeItems = resumeRes;
    }
  } catch {
    /* safe defaults above */
  }

  // Recompute the active topic against the (possibly empty) list for rendering.
  const activeTopic = topicParam ? topics.find((t) => t.slug === topicParam) : undefined;
  const populatedTopics = topics.filter((t) => t.count > 0);
  const filtered = Boolean(q || category || filter || activeTopic);
  const shown = items.length;
  const hasMore = shown < total;

  const eyebrow = filter
    ? FILTER_META[filter].eyebrow
    : activeTopic
      ? "Topic"
      : q
        ? "Search"
        : category
          ? "Category"
          : "Everything else";
  const heading = filter
    ? FILTER_META[filter].heading
    : activeTopic
      ? activeTopic.label
      : q
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

      {/* Category filter row. */}
      <nav className="border-b border-rule-hairline" aria-label="Filter by category">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-3 px-6 py-4">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted">Category</span>
          <div className="flex flex-wrap gap-2">
            <Link
              href={contentHref({ q, topic: activeTopic?.slug })}
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
                  href={contentHref({ q, category: cat.value, topic: activeTopic?.slug })}
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

      {/* Topic filter row — the AI-tagged life-situation facet. Shown only once
          some content carries topics (each pill is a populated room). */}
      {populatedTopics.length > 0 && (
        <nav className="border-b border-rule-hairline" aria-label="Filter by topic">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-3 px-6 py-4">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted">Topic</span>
            <div className="flex flex-wrap gap-2">
              <Link
                href={contentHref({ q, category })}
                aria-current={!activeTopic ? "page" : undefined}
                className={`${PILL_BASE} ${!activeTopic ? PILL_ACTIVE : PILL_INACTIVE}`}
              >
                All
              </Link>
              {populatedTopics.map((t) => {
                const active = activeTopic?.slug === t.slug;
                return (
                  <Link
                    key={t.id}
                    href={contentHref({ q, category, topic: t.slug })}
                    aria-current={active ? "page" : undefined}
                    className={`${PILL_BASE} ${active ? PILL_ACTIVE : PILL_INACTIVE}`}
                  >
                    {t.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      )}

      <div className="mx-auto max-w-6xl space-y-14 px-6 py-10">
        {/* Curated shelves + topic rooms — only on the default browse view.
            The member's own "Pick up where you left off" row leads, when they
            have anything in progress. */}
        {!filtered && (
          <>
            <ResumeShelf items={resumeItems} />
            {series.map((s) => (
              <Shelf
                key={s.challenge.id}
                eyebrow="Series"
                title={s.challenge.title}
                description={s.challenge.summary}
                seeAllHref={`/challenges/${s.challenge.id}`}
                seeAllLabel={`See all ${s.challenge.length_days}`}
                items={s.items}
              />
            ))}
            <Shelf
              eyebrow="Under 3 minutes"
              title="Enough time in a car park"
              description="Short enough to watch before you go back inside."
              seeAllHref={contentHref({ filter: "short" })}
              items={shortItems}
            />
            <Shelf
              eyebrow="Read & download"
              title="Things to keep"
              description="Worksheets, checklists and short reads you can print."
              seeAllHref={contentHref({ filter: "reads" })}
              items={readItems}
            />

            {populatedTopics.length > 0 && (
              <section>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-light-2">
                  Browse by topic
                </p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight">Walk into any of them.</h2>
                <div className="mt-3 border-t border-brand-accent" />
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {populatedTopics.map((t, i) => (
                    <Link
                      key={t.id}
                      href={contentHref({ topic: t.slug })}
                      className="group border border-rule-border p-4 transition-colors hover:border-foreground"
                    >
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-light-2">
                        {String(i + 1).padStart(2, "0")}
                      </p>
                      <p className="mt-2 font-extrabold leading-tight tracking-tight">{t.label}</p>
                      <p className="mt-1 text-xs text-muted">
                        {t.count} {t.count === 1 ? "piece" : "pieces"}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* All content grid. */}
        <div>
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
                    href={contentHref({ q, category, topic: activeTopic?.slug, filter, page: page + 1 })}
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
      </div>
    </main>
  );
}
