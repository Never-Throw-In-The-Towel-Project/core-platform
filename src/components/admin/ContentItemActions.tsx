"use client";

import Link from "next/link";
import { useActionState } from "react";
import { setContentItemPublished, deleteContentItem } from "@/lib/actions/content";
import { initialRoutineState } from "@/lib/actions/routineState";

/**
 * Per-item Studio controls: publish/unpublish and delete. The in-app way to fix
 * or pull a content item (e.g. a mistyped Vimeo ID) that previously needed raw
 * SQL. On success the server page revalidates, so the list reflects the change.
 */
export function ContentItemActions({
  id,
  isPublished,
  title,
}: {
  id: string;
  isPublished: boolean;
  title: string;
}) {
  const [pubState, pubAction, pubPending] = useActionState(setContentItemPublished, initialRoutineState);
  const [delState, delAction, delPending] = useActionState(deleteContentItem, initialRoutineState);

  const error = pubState.status === "error" ? pubState.message : delState.status === "error" ? delState.message : null;

  return (
    <span className="flex shrink-0 items-center gap-2">
      <Link
        href={`/admin/content/${id}/edit`}
        className="border border-rule-border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted hover:text-foreground"
      >
        Edit
      </Link>
      <form action={pubAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="published" value={isPublished ? "false" : "true"} />
        <button
          type="submit"
          disabled={pubPending}
          className="border border-rule-border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted hover:text-foreground disabled:opacity-50"
        >
          {pubPending ? "…" : isPublished ? "Unpublish" : "Publish"}
        </button>
      </form>
      <form
        action={delAction}
        onSubmit={(e) => {
          if (!window.confirm(`Delete “${title}”? This can’t be undone.`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          disabled={delPending}
          className="border border-rule-border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep hover:bg-brand-accent hover:text-brand-accent-foreground disabled:opacity-50"
        >
          {delPending ? "…" : "Delete"}
        </button>
      </form>
      {error ? <span className="text-[10px] text-red-700">{error}</span> : null}
    </span>
  );
}
