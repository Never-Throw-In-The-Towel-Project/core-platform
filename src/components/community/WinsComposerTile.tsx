"use client";

import { useState } from "react";
import { PostComposer } from "./PostComposer";

/** The grid's "Add your win" tile -- a red prompt that expands into the real composer in place, rather than a separate section above the board. */
export function WinsComposerTile() {
  const [isOpen, setIsOpen] = useState(false);

  if (isOpen) {
    return (
      <div className="border border-rule-border p-3">
        <PostComposer scope="global" board="wins" placeholder="What's a win, big or small, from your day or week?" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className="flex min-h-32 w-full items-center justify-center bg-brand-accent text-sm font-bold uppercase tracking-wide text-brand-accent-foreground transition-colors hover:bg-brand-accent-deep"
    >
      + Add your win
    </button>
  );
}
