"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitCommunityPost } from "@/lib/actions/community";
import { initialRoutineState } from "@/lib/actions/routineState";
import type { CommunityBoard, CommunityScope } from "@/types/database";

export function PostComposer({
  scope,
  board,
  placeholder,
}: {
  scope: CommunityScope;
  board: CommunityBoard;
  placeholder: string;
}) {
  const [state, formAction, isPending] = useActionState(submitCommunityPost, initialRoutineState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2 border border-current/15 p-3">
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="board" value={board} />
      <div className="flex gap-2">
        <textarea
          name="body"
          required
          rows={1}
          placeholder={placeholder}
          aria-label={placeholder}
          className="flex-1 resize-none border border-current/15 bg-transparent px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 bg-brand-accent px-4 py-2 text-sm font-semibold text-brand-accent-foreground disabled:opacity-50"
        >
          {isPending ? "…" : "Post"}
        </button>
      </div>
      <input
        name="image"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        aria-label="Add an optional photo to your post"
        className="w-full text-xs file:mr-3 file:border-0 file:bg-current/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold"
      />
      <p className="text-xs opacity-60">Optional photo -- JPEG, PNG, WebP, or GIF, up to 5MB.</p>
      {state.status === "error" && <p className="text-sm text-red-700">{state.message}</p>}
    </form>
  );
}
