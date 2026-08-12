import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ContentVideo } from "@/types/database";

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  return `${Math.round(seconds / 60)} min`;
}

/**
 * The watch page a Content Library row opens into (see ../page.tsx). Renders
 * the Vimeo player directly rather than a click-to-load placeholder --
 * this page only exists because someone already chose to watch this video
 * from the library list, so there's no reason to make them click twice.
 * Restyled to the Modernist system: a muted uppercase back-link, the player
 * in a 2px ink frame, an extrabold title, and neutral hairline metadata
 * badges (tags are metadata here, not links, so they take the neutral chip,
 * not the accent).
 */
export default async function ContentVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  // Treated the same as "video not found" below, since either way there's
  // nothing to safely render on this watch page.
  let video: ContentVideo | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("content_videos").select("*").eq("id", id).maybeSingle();
    video = data;
  } catch {
    video = null;
  }

  if (!video) {
    notFound();
  }

  const duration = formatDuration(video.duration_seconds);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/content"
        className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted transition-colors hover:text-foreground"
      >
        ← Library
      </Link>

      <div className="mt-6 aspect-video w-full overflow-hidden border-2 border-foreground">
        <iframe
          src={`https://player.vimeo.com/video/${video.vimeo_id}`}
          title={video.title}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>

      <h1 className="mt-6 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{video.title}</h1>
      {(video.tags.length > 0 || duration) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
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
      )}
    </main>
  );
}
