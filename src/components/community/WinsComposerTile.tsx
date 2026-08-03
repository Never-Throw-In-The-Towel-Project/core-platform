"use client";

import { useState } from "react";
import { PostComposer } from "./PostComposer";

/** The grid's "Add your win" tile -- a red prompt that expands into the real composer in place, rather than a separate section above the board. */
export function WinsComposerTile() {
  const [isOpen, setIsOpen] = useState(false);

  if (isOpen) {
    return (
      <div className="border border-current/15 p-3">
        <PostComposer scope="global" board="wins" placeholder="What's a win, big or small, from your day or week?" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className="flex min-h-32 w-full items-center justify-center bg-brand-accent text-sm font-semibold text-brand-accent-foreground"
    >
      + Add your win
    </button>
  );
}
