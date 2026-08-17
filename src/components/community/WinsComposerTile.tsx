"use client";

import { useState } from "react";
import { PostComposer } from "./PostComposer";

/**
 * The board's "Add your win" tile -- an inviting accent prompt that expands into
 * the real composer in place. Placed first in the grid so sharing a win is the
 * first thing on the board.
 */
export function WinsComposerTile({ authorName }: { authorName?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  if (isOpen) {
    return (
      <div className="border border-rule-border bg-background p-3 sm:col-span-2 lg:col-span-1">
        <p className="mb-2 px-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-deep">
          Share a win
        </p>
        <PostComposer
          scope="global"
          board="wins"
          placeholder="What's a win, big or small, from your day or week?"
          authorName={authorName}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className="group flex min-h-44 w-full flex-col items-center justify-center gap-2 bg-brand-accent p-5 text-brand-accent-foreground transition-colors hover:bg-brand-accent-deep"
    >
      <span aria-hidden className="text-3xl font-light leading-none">
        +
      </span>
      <span className="text-sm font-extrabold uppercase tracking-wide">Add your win</span>
      <span className="text-xs font-medium opacity-90">Big or small — they all count</span>
    </button>
  );
}
