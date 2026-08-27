"use client";

import { useEffect, useRef } from "react";
// Type-only import: fully erased at build, so the browser-only SDK never loads
// during SSR/RSC. The real module is pulled in with a dynamic import() inside
// the effect below, which only ever runs on the client.
import type PlayerType from "@vimeo/player";
import { buildVimeoEmbedUrl } from "@/lib/vimeo/parse";
import { recordContentProgress } from "@/lib/actions/contentProgress";
import { resumeTarget, isEffectivelyComplete } from "@/lib/content/progressInput";

/** Persist at most this often while the video is playing (a pause/end flushes
 *  immediately regardless). Keeps writes to a trickle without losing much on a
 *  hard tab close. */
const SAVE_INTERVAL_MS = 10_000;

/**
 * The member watch player — a Vimeo embed wired to "Pick up where you left off".
 * On mount it attaches the official @vimeo/player SDK to the existing iframe,
 * seeks to the saved resume position (guarded so it never lands in the final few
 * seconds and never resumes a finished watch), and records position as playback
 * moves on — throttled, plus a flush on pause, on end, and when the tab is
 * hidden. Progress is written through a private, own-rows server action
 * (recordContentProgress); nothing here reads across members. Video items only.
 */
export function VimeoWatch({
  contentItemId,
  vimeoId,
  vimeoHash,
  title,
  initialPositionSeconds,
  initialCompleted,
}: {
  contentItemId: string;
  vimeoId: string;
  vimeoHash: string | null;
  title: string;
  initialPositionSeconds: number;
  initialCompleted: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let player: PlayerType | null = null;
    let cancelled = false;

    // Latest position/duration the player has reported, and what we last wrote,
    // so throttled saves can skip no-op writes.
    const latest = { seconds: 0, duration: 0 };
    let lastSaveTs = 0;
    let lastSavedPos = -1;
    let lastSavedCompleted = initialCompleted;

    const persist = (opts?: { completed?: boolean; force?: boolean }) => {
      const seconds = Math.floor(latest.seconds);
      const duration = latest.duration > 0 ? Math.floor(latest.duration) : null;
      const completed = opts?.completed ?? isEffectivelyComplete(seconds, duration);
      // Nothing worth recording before playback has actually moved.
      if (seconds <= 0 && !completed) return;
      if (!opts?.force && seconds === lastSavedPos && completed === lastSavedCompleted) return;
      lastSavedPos = seconds;
      lastSavedCompleted = completed;
      lastSaveTs = Date.now();
      void recordContentProgress({
        contentItemId,
        positionSeconds: seconds,
        durationSeconds: duration,
        completed,
      }).catch(() => {
        // Best-effort: a member just watching a video never sees a save fail.
      });
    };

    const onTimeUpdate = (data: { seconds: number; duration: number }) => {
      latest.seconds = data.seconds;
      latest.duration = data.duration;
      if (Date.now() - lastSaveTs >= SAVE_INTERVAL_MS) persist();
    };
    const onPause = () => persist({ force: true });
    const onEnded = () => persist({ completed: true, force: true });
    const onVisibility = () => {
      if (document.visibilityState === "hidden") persist({ force: true });
    };

    document.addEventListener("visibilitychange", onVisibility);

    void import("@vimeo/player")
      .then(({ default: Player }) => {
        if (cancelled || !iframeRef.current) return;
        player = new Player(iframeRef.current);
        player.on("timeupdate", onTimeUpdate);
        player.on("pause", onPause);
        player.on("ended", onEnded);

        // getDuration() resolves only once the player is ready, so seeking in
        // here can't race initialisation.
        player
          .getDuration()
          .then((duration) => {
            const target = resumeTarget(initialPositionSeconds, duration, initialCompleted);
            if (target != null && player) void player.setCurrentTime(target).catch(() => {});
          })
          .catch(() => {});
      })
      .catch(() => {
        // If the SDK fails to load, the plain embed still plays — we just don't
        // capture or resume progress for this session.
      });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (player) {
        player.off("timeupdate", onTimeUpdate);
        player.off("pause", onPause);
        player.off("ended", onEnded);
        persist({ force: true });
        void player.destroy().catch(() => {});
      }
    };
  }, [contentItemId, initialPositionSeconds, initialCompleted]);

  return (
    <iframe
      ref={iframeRef}
      src={buildVimeoEmbedUrl(vimeoId, vimeoHash)}
      title={title}
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
      className="h-full w-full"
    />
  );
}
