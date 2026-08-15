"use client";

import { useActionState, useRef } from "react";
import { moveItemToFolder } from "@/lib/actions/contentFolders";
import { initialRoutineState } from "@/lib/actions/routineState";

/**
 * Per-card "file into folder" control for the Brain grid. A folder <select> that
 * auto-submits on change to moveItemToFolder ("" = Unfiled). On success the
 * server revalidates /admin/brain, so an item moved out of the current folder
 * view simply drops from the grid.
 */
export function BrainMoveControl({
  itemId,
  folderId,
  folders,
}: {
  itemId: string;
  folderId: string | null;
  folders: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(moveItemToFolder, initialRoutineState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="flex items-center gap-1">
      <input type="hidden" name="itemId" value={itemId} />
      <label htmlFor={`move-${itemId}`} className="sr-only">
        Move to folder
      </label>
      <select
        id={`move-${itemId}`}
        name="folderId"
        defaultValue={folderId ?? ""}
        disabled={pending}
        onChange={() => formRef.current?.requestSubmit()}
        className="max-w-[9rem] truncate border border-rule-border bg-transparent px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted hover:text-foreground disabled:opacity-50"
      >
        <option value="">Unfiled</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      {state.status === "error" && (
        <span className="text-[10px] text-brand-accent-deep">{state.message}</span>
      )}
    </form>
  );
}
