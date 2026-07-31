import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { escapeFilterValue } from "@/lib/supabase/filterEscape";
import { VimeoEmbed } from "@/components/VimeoEmbed";
import type { ContentVideo, VideoCategory } from "@/types/database";

const CATEGORIES: { value: VideoCategory; label: string; blurb: string }[] = [
  {
    value: "mental_fitness",
    label: "Mental Fitness",
    blurb: "Real stories on real-life topics -- addiction, grief, redundancy, anxiety, and more.",
  },
  {
    value: "physical_fitness",
    label: "Physical Fitness",
    blurb: "Workout demos for every tier, plus general movement, stretching, and breathwork.",
  },
  {
    value: "tools_tips",
    label: "Tools & Tips",
    blurb: "Short, practical videos for the moment -- coping tools, sleep, hydration, nutrition.",
  },
];

/**
 * Content Library -- one shared library, built once, available to every
 * company (see docs/ARCHITECTURE.md "Core platform vs. co-branded
 * portals"). Search is title/tag based so someone in a hard moment can
 * search "divorce" or "addiction" and land directly on relevant content,
 * per the brief.
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

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    videos: videos.filter((v) => v.category === cat.value),
  })).filter((cat) => !category || cat.value === category);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Content Library</h1>
      <p className="mt-1 opacity-80">Find what you need, whenever you need it.</p>

      <form className="mt-6 flex gap-2" action="/content">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by topic -- e.g. grief, sleep, breathwork"
          className="flex-1 rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm"
        />
        {category && <input type="hidden" name="category" value={category} />}
        <button type="submit" className="rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-white">
          Search
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link
          href="/content"
          className={`rounded-full border border-white/20 px-3 py-1 ${!category ? "bg-brand-accent text-white" : "opacity-70"}`}
        >
          All
        </Link>
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.value}
            href={`/content?category=${cat.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-full border border-white/20 px-3 py-1 ${category === cat.value ? "bg-brand-accent text-white" : "opacity-70"}`}
          >
            {cat.label}
          </Link>
        ))}
      </div>

      {grouped.map((cat) => (
        <section key={cat.value} className="mt-10">
          <h2 className="text-lg font-semibold">{cat.label}</h2>
          <p className="mt-1 text-sm opacity-70">{cat.blurb}</p>

          {cat.videos.length === 0 ? (
            <p className="mt-4 text-sm opacity-60">
              {q ? "No matches here." : "Nothing here yet -- check back soon."}
            </p>
          ) : (
            <div className="mt-4 space-y-6">
              {cat.videos.map((video) => (
                <div key={video.id} className="space-y-2">
                  <VimeoEmbed vimeoId={video.vimeo_id} title={video.title} />
                  <p className="text-sm font-medium">{video.title}</p>
                  {video.tags.length > 0 && (
                    <p className="text-xs opacity-60">{video.tags.join(" · ")}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </main>
  );
}
