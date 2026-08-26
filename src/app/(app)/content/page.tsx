import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/dal";
import { listContentItems, getDayContent } from "@/lib/content/queries";
import { rotateForWeek, isoWeekdayFromName, DAY_LABEL } from "@/lib/content/rotation";
import { weekdayNameOrWeekend, getIsoWeekNumber } from "@/lib/routines/dates";
import { DayCarousel } from "@/components/content/DayCarousel";
import type { ContentItem, VideoCategory } from "@/types/database";

const CATEGORIES: { value: VideoCategory; label: string }[] = [
  { value: "mental_fitness", label: "Mental Fitness" },
  { value: "tools_tips", label: "Tools & Tips" },
  { value: "physical_fitness", label: "Physical Fitness" },
  { value: "nutrition", label: "Nutrition" },
];

// The brief's own enumerated Mental Fitness topics ("addiction, divorce,
// grief, redundancy, identity loss, anxiety, relationships, purpose") --
// quick shortcuts into the same free-text search every item is already
// searchable by (title or tags), not a separate filter mechanism.
const TOPICS = ["Addiction", "Divorce", "Grief", "Redundancy", "Identity loss", "Anxiety", "Relationships", "Purpose"];

const TYPE_LABEL: Record<ContentItem["type"], string> = {
  video: "Watch",
  document: "Read",
  image: "View",
  text: "Read",
};

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  return `${Math.round(seconds / 60)} min`;
}

// Preserve the sibling query param when building a filter link, so choosing a
// category doesn't drop the active search and vice-versa (a topic chip keeps
// the chosen category; a category tab keeps the typed search).
function categoryHref(value: VideoCategory | null, q: string | undefined): string {
  const params = new URLSearchParams();
  if (value) params.set("category", value);
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/content?${qs}` : "/content";
}

function topicHref(topic: string, category: string | undefined): string {
  const params = new URLSearchParams({ q: topic });
  if (category) params.set("category", category);
  return `/content?${params.toString()}`;
}

// Shared active/inactive treatment for the category tab bar -- the same 3px
// vivid-accent underline the Community sub-nav and the mobile BottomNav use for
// their active tab (globals.css reserves --brand-accent-vivid for exactly these
// decorative active-state borders, where no text is read against the red).
const TAB_BASE =
  "-mb-px block whitespace-nowrap border-b-[3px] py-3.5 text-xs font-bold uppercase tracking-[0.14em] transition-colors";
const TAB_ACTIVE = "border-brand-accent-vivid text-foreground";
const TAB_INACTIVE = "border-transparent text-muted hover:text-foreground";

/**
 * Content Library -- one shared library, built once, available to every
 * company (see docs/ARCHITECTURE.md "Core platform vs. co-branded portals").
 * Reads the content_items spine (docs/CONTENT_PLATFORM_STRATEGY.md), so it
 * shows videos, documents, and images alike; channel targeting is enforced by
 * the content_items RLS policy for the viewer's own session.
 *
 * Search-first: someone in a hard moment should be able to search "divorce"
 * or "addiction" and land directly on relevant content. On the default browse
 * view (no search/filter) a day-of-week carousel leads -- today's rotating
 * pick from the Mon–Sun grid.
 */
export default async function ContentLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;

  // The viewer's own timezone decides which weekday "today" is and which ISO
  // week drives the rotation -- consistent with the rest of the platform's
  // timezone-correct day/week resolution (Phase 9).
  const profile = await getProfile();
  const now = new Date();
  const tz = profile.timezone;
  const isoWeekday = isoWeekdayFromName(weekdayNameOrWeekend(now, tz));
  const isoWeek = getIsoWeekNumber(now, tz);
  const dayLabel = DAY_LABEL[isoWeekday];

  // Wrapped in try/catch: createClient() throws synchronously if the URL/key
  // are missing or malformed. Degrading to empty results is the same "Nothing
  // here yet" state this page already renders for a genuinely empty library.
  let items: ContentItem[] = [];
  let dayItems: ContentItem[] = [];
  try {
    const supabase = await createClient();
    [items, dayItems] = await Promise.all([
      listContentItems(supabase, { q, category }),
      getDayContent(supabase, isoWeekday),
    ]);
  } catch {
    items = [];
    dayItems = [];
  }
  const rotatedDay = rotateForWeek(dayItems, isoWeek);

  return (
    <main className="min-h-full">
      {/* Search-first ink hero -- the deliberate emphasis moment. */}
      <section className="bg-brand-background text-brand-foreground">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-light-2">
            Library
          </p>
          <h1 className="mt-2 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            What do you need right now?
          </h1>
          <p className="mt-4 max-w-lg text-muted-on-ink-2">
            Search a topic and go straight there — no browsing required.
          </p>

          <form className="mt-6 flex gap-2" action="/content" role="search">
            <label htmlFor="content-search" className="sr-only">
              Search content by topic
            </label>
            <input
              id="content-search"
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search a topic — divorce, grief, sleep, redundancy…"
              className="min-w-0 flex-1 border-2 border-brand-foreground bg-transparent px-4 py-3.5 text-brand-foreground placeholder:text-muted-on-ink"
            />
            {category && <input type="hidden" name="category" value={category} />}
            <button
              type="submit"
              className="shrink-0 bg-brand-foreground px-6 py-3.5 text-sm font-extrabold uppercase tracking-wide text-brand-background transition-colors hover:bg-brand-accent hover:text-brand-accent-foreground"
            >
              Search
            </button>
          </form>

          <p className="mt-5 text-sm text-muted-on-ink-2">
            Prefer something guided?{" "}
            <Link href="/challenges" className="font-bold text-brand-accent-light-2 underline underline-offset-2">
              Explore challenges →
            </Link>
          </p>
        </div>
      </section>

      {/* Category filter -- the taxonomy tabs (All + the categories), carrying
          the active search across a category change. */}
      <nav className="border-b border-rule-hairline" aria-label="Filter by category">
        <div className="mx-auto max-w-5xl px-6">
          <ul className="flex gap-7 overflow-x-auto">
            <li className="shrink-0">
              <Link
                href={categoryHref(null, q)}
                aria-current={!category ? "page" : undefined}
                className={`${TAB_BASE} ${!category ? TAB_ACTIVE : TAB_INACTIVE}`}
              >
                All
              </Link>
            </li>
            {CATEGORIES.map((cat) => {
              const active = category === cat.value;
              return (
                <li key={cat.value} className="shrink-0">
                  <Link
                    href={categoryHref(cat.value, q)}
                    aria-current={active ? "page" : undefined}
                    className={`${TAB_BASE} ${active ? TAB_ACTIVE : TAB_INACTIVE}`}
                  >
                    {cat.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Day-of-week carousel -- only on the default browse view; a search or
            category filter is a focused intent, so the carousel steps aside. */}
        {!q && !category && (
          <div className="mb-8">
            <DayCarousel dayLabel={dayLabel} items={rotatedDay} />
          </div>
        )}

        {/* Topic shortcuts -- one tap fills the same free-text search. */}
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Quick topics</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {TOPICS.map((topic) => {
            const active = q?.toLowerCase() === topic.toLowerCase();
            return (
              <Link
                key={topic}
                href={topicHref(topic, category)}
                aria-current={active ? "true" : undefined}
                className={
                  "border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] transition-colors " +
                  (active
                    ? "border-brand-accent bg-brand-accent text-brand-accent-foreground"
                    : "border-rule-border text-muted hover:border-foreground hover:text-foreground")
                }
              >
                {topic}
              </Link>
            );
          })}
        </div>

        {/* Results */}
        <div className="mt-8">
          {items.length === 0 ? (
            <p className="py-8 text-sm text-muted">
              {q || category ? "No matches here." : "Nothing here yet — check back soon."}
            </p>
          ) : (
            <ul>
              {items.map((item) => {
                const duration = formatDuration(item.duration_seconds);
                return (
                  <li key={item.id}>
                    <Link
                      href={`/content/${item.id}`}
                      className="flex gap-4 border-t border-rule-hairline py-5 transition-colors hover:bg-foreground/[0.03]"
                    >
                      {/* A real still when one was captured (e.g. a Vimeo thumbnail);
                          otherwise an honest framed placeholder labelled by type. */}
                      {item.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- remote poster URL, not a local/optimizable asset
                        <img
                          src={item.thumbnail_url}
                          alt=""
                          className="h-20 w-32 shrink-0 border border-rule-border object-cover"
                        />
                      ) : (
                        <div className="flex h-20 w-32 shrink-0 items-center justify-center border border-rule-border bg-foreground/[0.04] text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                          {TYPE_LABEL[item.type]}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-extrabold leading-tight tracking-tight">{item.title}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              className="border border-rule-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted"
                            >
                              {tag}
                            </span>
                          ))}
                          {duration && <span className="text-xs text-muted">{duration}</span>}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
