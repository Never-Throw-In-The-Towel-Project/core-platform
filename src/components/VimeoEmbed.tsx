"use client";

import { useState } from "react";

/**
 * Lazy-embedded Vimeo player -- the brief calls for an embedded player, not
 * just a link out, but rendering every video's iframe up front on a library
 * page is wasteful. Starts as a lightweight "Watch" card, swaps in the real
 * iframe only once tapped.
 */
export function VimeoEmbed({ vimeoId, title }: { vimeoId: string; title: string }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg">
        <iframe
          src={`https://player.vimeo.com/video/${vimeoId}`}
          title={title}
          allow="autoplay; fullscreen; picture-in-picture"
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
      className="flex aspect-video w-full items-center justify-center rounded-lg border border-white/10 text-sm font-medium opacity-80 hover:opacity-100"
    >
      ▶ Watch
    </button>
  );
}
