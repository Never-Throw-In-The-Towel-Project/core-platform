"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { submitCommunityPost } from "@/lib/actions/community";
import { initialRoutineState } from "@/lib/actions/routineState";

// The default message is deliberately GENERIC and editable -- it never names the
// habit. What someone was quitting is private; only the member can add it, in
// their own words, if they choose. The Wins Board is public, so the composer
// says so plainly before a single character is posted.
const DEFAULT_WIN =
  "I set myself a goal and I stuck to it. Clean streak complete — proud of this one. 🏆";

/**
 * "Share your win": the completion moment's bridge to the public Wins Board.
 * Posts through the same submitCommunityPost (scope global, board wins) the
 * board itself uses, so a shared win is an ordinary wins post -- with an
 * optional trophy photo. Collapsed until the member chooses to open it; nothing
 * is shared automatically. When the member hasn't joined the community yet, we
 * point them at the board (which carries the guidelines opt-in) instead of
 * showing a composer that would just error.
 */
export function ShareWinComposer({ canShare, authorName }: { canShare: boolean; authorName?: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(submitCommunityPost, initialRoutineState);
  const [fileName, setFileName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  if (!canShare) {
    return (
      <div className="border-2 border-foreground p-6">
        <h2 className="text-xl font-extrabold tracking-tight">Share your win</h2>
        <p className="mt-1.5 text-sm text-muted">
          Wins are celebrated on the community Wins Board. Join the community and you can post yours — a photo of your
          trophy, or just a few words. You choose what to share; what you were quitting is never added for you.
        </p>
        <Link
          href="/community/wins"
          className="mt-4 inline-block bg-success px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-success-foreground"
        >
          Go to the Wins Board →
        </Link>
      </div>
    );
  }

  if (state.status === "success") {
    return (
      <div className="border-2 border-success p-6">
        <p className="text-2xl font-extrabold leading-tight tracking-tight">Shared to the Wins Board 🎉</p>
        <p className="mt-2 text-sm text-muted">Nice one. Your win is up for the community to cheer on.</p>
        <Link
          href="/community/wins"
          className="mt-4 inline-block text-xs font-extrabold uppercase tracking-wide text-brand-accent-deep"
        >
          See it on the board →
        </Link>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="border-2 border-foreground p-6">
        <h2 className="text-xl font-extrabold tracking-tight">Share your win</h2>
        <p className="mt-1.5 text-sm text-muted">
          Take it to the community Wins Board — add a photo of your trophy if you have one. It&rsquo;s public, and what
          you were quitting is never mentioned unless you write it yourself.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex items-center gap-2 bg-success px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-success-foreground"
        >
          Share your win
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} className="border-2 border-foreground p-6">
      <input type="hidden" name="scope" value="global" />
      <input type="hidden" name="board" value="wins" />

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold tracking-tight">Share your win</h2>
        <span className="bg-foreground/[0.06] px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
          Public · Wins Board
        </span>
      </div>

      <label htmlFor="win-body" className="sr-only">
        Your win
      </label>
      <textarea
        id="win-body"
        name="body"
        required
        rows={3}
        defaultValue={DEFAULT_WIN}
        maxLength={2000}
        aria-describedby="win-privacy-note"
        className="mt-3 w-full resize-none border-2 border-foreground bg-transparent px-3 py-2.5 text-[15px] leading-relaxed"
      />
      <p id="win-privacy-note" className="mt-1.5 text-xs text-muted">
        This posts to the public Wins Board. Edit it however you like — it won&rsquo;t mention what you were quitting
        unless you add that yourself.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="2.5" y="3.5" width="15" height="13" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="7" cy="8" r="1.5" fill="currentColor" />
            <path d="M3 15l4.5-4.5 3.5 3.5 3-3 3 3" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
          <span className="max-w-[12rem] truncate">{fileName ?? "Add your trophy photo"}</span>
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            aria-label="Add an optional photo of your trophy"
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>
        {authorName && <span className="text-xs text-muted">Posting as {authorName}</span>}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-success px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-success-foreground disabled:opacity-50"
        >
          {pending ? "Posting…" : "Post to the Wins Board"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-extrabold uppercase tracking-wide text-muted underline"
        >
          Not now
        </button>
      </div>

      {state.status === "error" && <p className="mt-3 text-sm font-semibold text-brand-accent-deep">{state.message}</p>}
    </form>
  );
}
