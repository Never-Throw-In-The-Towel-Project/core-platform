import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { escapeFilterValue } from "@/lib/supabase/filterEscape";
import type { ContentVideo, VideoCategory } from "@/types/database";

const CATEGORIES: { value: VideoCategory; label: string }[] = [
  { value: "mental_fitness", label: "Mental Fitness" },
  { value: "tools_tips", label: "Tools & Tips" },
  { value: "physical_fitness", label: "Physical Fitness" },
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

/**
 * Content Library -- one shared library, built once, available to every
 * company (see docs/ARCHITECTURE.md "Core platform vs. co-branded
 * portals"). Search-first: someone in a hard moment should be able to
 * search "divorce" or "addiction" and land directly on relevant content
 * rather than browsing, per the brief.
 */
export default async function ContentLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
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
  const videos = (data as ContentVideo[] | null) ?? [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-extrabold uppercase">What do you need right now?</h1>

      <form className="mt-6" action="/content">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search a topic — divorce, grief, sleep, redundancy…"
          className="w-full border border-current/20 bg-transparent px-4 py-3 text-sm"
        />
        {category && <input type="hidden" name="category" value={category} />}
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {TOPICS.map((topic) => (
          <Link
            key={topic}
            href={`/content?q=${encodeURIComponent(topic)}${category ? `&category=${category}` : ""}`}
            className={
              "border px-2 py-1 text-xs font-semibold uppercase " +
              (q?.toLowerCase() === topic.toLowerCase()
                ? "border-brand-accent bg-brand-accent text-brand-accent-foreground"
                : "border-brand-accent text-brand-accent")
            }
          >
            {topic}
          </Link>
        ))}
      </div>

      <nav className="mt-6 flex gap-6 border-t border-b border-current/10 py-3 text-sm">
        <Link
          href={`/content${q ? `?q=${encodeURIComponent(q)}` : ""}`}
          className={!category ? "font-semibold text-brand-accent" : "opacity-60 hover:opacity-100"}
        >
          All
        </Link>
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.value}
            href={`/content?category=${cat.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={category === cat.value ? "font-semibold text-brand-accent" : "opacity-60 hover:opacity-100"}
          >
            {cat.label}
          </Link>
        ))}
      </nav>

      <div className="mt-2">
        {videos.length === 0 && (
          <p className="py-6 text-sm opacity-60">
            {q || category ? "No matches here." : "Nothing here yet -- check back soon."}
          </p>
        )}
        {videos.map((video) => {
          const duration = formatDuration(video.duration_seconds);
          return (
            <Link
              key={video.id}
              href={`/content/${video.id}`}
              className="flex gap-4 border-t border-current/10 py-4 hover:opacity-80"
            >
              <div className="flex h-20 w-28 shrink-0 items-center justify-center bg-current/10 text-xs uppercase opacity-60">
                Still
              </div>
              <div className="min-w-0">
                <p className="font-medium">{video.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  {video.tags.map((tag) => (
                    <span key={tag} className="border border-current/15 px-1.5 py-0.5 uppercase opacity-60">
                      {tag}
                    </span>
                  ))}
                  {duration && <span className="opacity-60">{duration}</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
