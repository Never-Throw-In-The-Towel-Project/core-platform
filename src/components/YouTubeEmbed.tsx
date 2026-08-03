"use client";

import { useState } from "react";

/**
 * Lazy-embedded YouTube player: starts as a lightweight thumbnail + play
 * button, only swaps in the real iframe once tapped, so a page with several
 * of these doesn't load every player up front. Used on the public marketing
 * pages (documentary trailer, podcast teaser) where the source video
 * already lives on Anthony's own YouTube channel -- distinct from the
 * Content Library, which is Vimeo-hosted and links out to a dedicated watch
 * page per video instead (src/app/(app)/content/[id]/page.tsx).
 *
 * Plain <img> rather than next/image for the thumbnail: next.config.ts has
 * no remotePatterns configured for img.youtube.com, and adding one just for
 * a lazy-loaded thumbnail isn't worth the config change.
 */
export function YouTubeEmbed({ youtubeId, title }: { youtubeId: string; title: string }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg">
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-black/10"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
        alt={title}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-brand-accent text-brand-accent-foreground">
        ▶
      </span>
    </button>
  );
}
