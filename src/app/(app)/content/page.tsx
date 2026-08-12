import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { escapeFilterValue } from "@/lib/supabase/filterEscape";
import type { ContentVideo, VideoCategory } from "@/types/database";

const CATEGORIES: { value: VideoCategory; label: string }[] = [
  { value: "mental_fitness", label: "Mental Fitness" },
  { value: "tools_tips", label: "Tools & Tips" },
  { value: "physical_fitness", label: "Physical Fitness" },
  { value: "nutrition", label: "Nutrition" },
];

// The brief's own enumerated Mental Fitness topics ("addiction, divorce,
// grief, redundancy, identity loss, anxiety, relationships, purpose") --
// quick shortcuts into the same free-text search every video is already
// searchable by (title or tags), not a separate filter mechanism. No
// content has been seeded into content_videos yet, so there's no
// established tag-casing convention to match against; these are plain
// human-readable strings, same as a user would type into the search box
// themselves.
const TOPICS = ["Addiction", "Divorce", "Grief", "Redundancy", "Identity loss", "Anxiety", "Relationships", "Purpose"];

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
 * company (see docs/ARCHITECTURE.md "Core platform vs. co-branded
 * portals"). Search-first: someone in a hard moment should be able to
 * search "divorce" or "addiction" and land directly on relevant content
 * rather than browsing, per the brief -- so the search itself is the focal
 * moment, set in the redesign's ink band, with the category tabs and topic
 * shortcuts as the two lighter refinements below it.
 */
export default async function ContentLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  // Degrading to an empty result is the same "Nothing here yet" state this
  // page already renders for a genuinely empty library.
  let videos: ContentVideo[] = [];
  try {
    const supabase = await createClient();

    let query = supabase.from("content_videos").select("*").order("created_at", { ascending: false });

    if (category) {
      query = query.eq("category", category);
    }
    if (q) {
      const escaped = escapeFilterValue(q);
      query = query.or(`title.ilike."%${escaped}%",tags.cs.{"${escaped}"}`);
    }

    const { data } = await query;
    videos = (data as ContentVideo[] | null) ?? [];
  } catch {
    videos = [];
  }

  return (
    <main className="min-h-full">
      {/* Search-first ink hero -- the deliberate emphasis moment, mirroring the
          Wins Board banner's ink-band recipe. The big question and the search
          box are the focus; the category tabs and topic chips sit below on
          paper. */}
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
        </div>
      </section>

      {/* Category filter -- the taxonomy tabs (All + the three categories),
          carrying the active search across a category change. */}
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
        {/* Topic shortcuts -- one tap fills the same free-text search. The
            selected topic takes the AA-safe filled-accent state; the rest are
            neutral hairline chips (square, per the zero-radius system). */}
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
          {videos.length === 0 ? (
            <p className="py-8 text-sm text-muted">
              {q || category ? "No matches here." : "Nothing here yet — check back soon."}
            </p>
          ) : (
            <ul>
              {videos.map((video) => {
                const duration = formatDuration(video.duration_seconds);
                return (
                  <li key={video.id}>
                    <Link
                      href={`/content/${video.id}`}
                      className="flex gap-4 border-t border-rule-hairline py-5 transition-colors hover:bg-foreground/[0.03]"
                    >
                      {/* No still is stored on content_videos (only the Vimeo
                          id), so the thumbnail is an honest framed placeholder,
                          not a fetched image -- flat, hairline-bordered, in the
                          zero-radius system. */}
                      <div className="flex h-20 w-32 shrink-0 items-center justify-center border border-rule-border bg-foreground/[0.04] text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                        Still
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold leading-tight tracking-tight">{video.title}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {video.tags.map((tag) => (
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
