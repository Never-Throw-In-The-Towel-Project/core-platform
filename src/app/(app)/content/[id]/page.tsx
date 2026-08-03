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
 */
export default async function ContentVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase.from("content_videos").select("*").eq("id", id).maybeSingle();
  const video = data as ContentVideo | null;

  if (!video) {
    notFound();
  }

  const duration = formatDuration(video.duration_seconds);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/content" className="text-sm opacity-70 hover:opacity-100">
        ← Library
      </Link>

      <div className="mt-4 aspect-video w-full overflow-hidden">
        <iframe
          src={`https://player.vimeo.com/video/${video.vimeo_id}`}
          title={video.title}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>

      <h1 className="mt-4 text-xl font-bold">{video.title}</h1>
      {(video.tags.length > 0 || duration) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {video.tags.map((tag) => (
            <span key={tag} className="border border-brand-accent px-1.5 py-0.5 uppercase text-brand-accent">
              {tag}
            </span>
          ))}
          {duration && <span className="opacity-60">{duration}</span>}
        </div>
      )}
    </main>
  );
}
