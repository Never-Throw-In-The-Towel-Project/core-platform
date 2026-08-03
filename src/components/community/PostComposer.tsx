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
    <form ref={formRef} action={formAction} className="space-y-2 rounded-lg border border-black/10 p-4">
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="board" value={board} />
      <textarea
        name="body"
        required
        rows={3}
        placeholder={placeholder}
        className="w-full rounded-md border border-black/20 bg-transparent px-3 py-2 text-sm"
      />
      <input
        name="image"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-black/10 file:px-3 file:py-1.5 file:text-sm file:font-semibold"
      />
      <p className="text-xs opacity-50">Optional photo -- JPEG, PNG, WebP, or GIF, up to 5MB.</p>
      {state.status === "error" && <p className="text-sm text-red-700">{state.message}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-brand-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Posting…" : "Post"}
      </button>
    </form>
  );
}
