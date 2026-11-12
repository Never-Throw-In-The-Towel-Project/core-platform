"use client";

import { useEffect, useState } from "react";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import { markWelcomeVideoSeen } from "@/lib/actions/welcomeVideo";
import { WELCOME_VIDEO_ID, WELCOME_VIDEO_TITLE } from "@/lib/welcome/video";

/**
 * First-run welcome-video prompt: a dismissible overlay with Anthony's embedded
 * "why NTITT" video. The home page renders this ONLY for a member who hasn't seen
 * it yet (profile.welcome_video_seen_at is null), so it simply opens on mount.
 * Dismissing (the X, "Got it", Esc, or the backdrop) stamps the seen flag so it
 * never shows again — and they can still watch it any time from Settings.
 *
 * The video is long, so the modal never autoplays it: YouTubeEmbed shows a
 * thumbnail + play button, the member taps to start, and can close at any point.
 */
export function WelcomeVideoModal() {
  const [open, setOpen] = useState(true);

  function dismiss() {
    setOpen(false);
    // Fire-and-forget: the server flag is what actually persists "seen"; the
    // local close is just the immediate UI.
    void markWelcomeVideoSeen();
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={WELCOME_VIDEO_TITLE}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      {/* Opt the card back to the light "paper" surface so it reads as a clean
          welcome card even over the dark Today board. */}
      <div data-surface="paper" className="my-auto w-full max-w-2xl border-2 border-foreground bg-background p-5 text-foreground">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep">Welcome</p>
            <h2 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight">{WELCOME_VIDEO_TITLE}</h2>
            <p className="mt-1 text-sm text-muted">
              A word from Anthony on why this platform exists — and why it&rsquo;s worth showing up for.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="shrink-0 border border-rule-border px-3 py-1.5 text-sm font-extrabold hover:border-foreground"
          >
            ✕
          </button>
        </div>

        <div className="mt-4">
          <YouTubeEmbed youtubeId={WELCOME_VIDEO_ID} title={WELCOME_VIDEO_TITLE} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">You can watch this again any time in Settings.</p>
          <button
            type="button"
            onClick={dismiss}
            className="bg-brand-accent px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
