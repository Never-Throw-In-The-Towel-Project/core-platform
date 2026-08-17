"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { submitCommunityPost } from "@/lib/actions/community";
import { initialRoutineState } from "@/lib/actions/routineState";
import { Avatar } from "./Avatar";
import type { CommunityBoard, CommunityScope } from "@/types/database";

export function PostComposer({
  scope,
  board,
  placeholder,
  authorName,
}: {
  scope: CommunityScope;
  board: CommunityBoard;
  placeholder: string;
  /** When set, the composer shows the author's avatar, social-composer style. */
  authorName?: string;
}) {
  const [state, formAction, isPending] = useActionState(submitCommunityPost, initialRoutineState);
  const formRef = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // Clear the file-name chip on a successful post via the render-phase pattern
  // (not a useEffect setState). The DOM form reset itself stays in the effect.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "success") setFileName(null);
  }

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="border border-rule-border bg-background">
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="board" value={board} />

      <div className="flex gap-3 p-3">
        {authorName && <Avatar name={authorName} className="mt-0.5 h-10 w-10 text-sm" />}
        <textarea
          name="body"
          required
          rows={2}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-h-[3rem] flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-relaxed placeholder:text-muted focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule-hairline px-3 py-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="2.5" y="3.5" width="15" height="13" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="7" cy="8" r="1.5" fill="currentColor" />
            <path d="M3 15l4.5-4.5 3.5 3.5 3-3 3 3" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
          <span className="max-w-[12rem] truncate">{fileName ?? "Add a photo"}</span>
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            aria-label="Add an optional photo to your post"
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 bg-brand-accent px-5 py-2 text-sm font-bold uppercase tracking-wide text-brand-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Posting…" : "Post"}
        </button>
      </div>

      {state.status === "error" && (
        <p className="border-t border-rule-hairline px-3 py-2 text-sm text-brand-accent-deep">{state.message}</p>
      )}
    </form>
  );
}
