"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { VimeoWatch } from "@/components/content/VimeoWatch";
import type { ContentItem } from "@/types/database";

/**
 * The Library watch modal — the video plays in a dark overlay ON the Library
 * instead of navigating to a separate page (the designers' ask). Opened by the
 * intercepting route (content/@modal/(.)[id]); on a hard load / refresh /
 * shared link, /content/[id] renders its full page instead.
 *
 * The player frame is sized to the video's REAL aspect ratio (reported by the
 * SDK via VimeoWatch), so a portrait video fills a tall narrow frame with no
 * white letterbox bars — the thing that made the old page look empty. Resume +
 * progress capture come for free (same VimeoWatch as the page). Closes on the ✕,
 * Escape, click-outside, or browser Back — all via router.back(), so the URL and
 * history stay correct.
 */
export function WatchModal({
  item,
  mediaUrl,
  resumePositionSeconds,
  resumeCompleted,
}: {
  item: ContentItem;
  mediaUrl: string | null;
  resumePositionSeconds: number;
  resumeCompleted: boolean;
}) {
  const router = useRouter();
  const [aspect, setAspect] = useState(16 / 9);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };
    document.addEventListener("keydown", onKey);
    // Lock the Library scroll behind the overlay; restore on close.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [router]);

  const isPortrait = aspect < 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      onClick={() => router.back()}
    >
      <div
        className="relative flex max-h-full w-full max-w-5xl flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Close"
          className="mb-2 -mr-2 inline-flex min-h-[40px] items-center self-end px-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/80 transition-colors hover:text-white"
        >
          Close ✕
        </button>

        {item.type === "video" && item.vimeo_id ? (
          <div
            className={`overflow-hidden border-2 border-brand-accent bg-black ${
              isPortrait ? "h-[74vh] w-auto max-w-full" : "h-auto max-h-[74vh] w-full"
            }`}
            style={{ aspectRatio: String(aspect) }}
          >
            <VimeoWatch
              contentItemId={item.id}
              vimeoId={item.vimeo_id}
              vimeoHash={item.vimeo_hash}
              title={item.title}
              initialPositionSeconds={resumePositionSeconds}
              initialCompleted={resumeCompleted}
              autoplay
              onAspectRatio={setAspect}
            />
          </div>
        ) : item.type === "image" && mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote Storage asset, not a local/optimizable image
          <img
            src={mediaUrl}
            alt={item.title}
            className="max-h-[78vh] max-w-full border-2 border-brand-accent object-contain"
          />
        ) : mediaUrl ? (
          <div className="flex w-full max-w-3xl flex-col items-center">
            <div className="h-[70vh] w-full overflow-hidden border-2 border-brand-accent bg-white">
              <iframe src={mediaUrl} title={item.title} className="h-full w-full" />
            </div>
            <a
              href={mediaUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block bg-brand-accent px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground transition-opacity hover:opacity-90"
            >
              Open ↗
            </a>
          </div>
        ) : (
          <p className="text-sm text-white/80">This content isn’t available to view right now.</p>
        )}

        <p className="mt-4 text-center text-lg font-extrabold leading-tight tracking-tight text-white sm:text-xl">
          {item.title}
        </p>
        {item.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {item.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="border border-white/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
