"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { renameFolder, deleteFolder } from "@/lib/actions/contentFolders";
import { initialRoutineState } from "@/lib/actions/routineState";

/**
 * Rename / delete controls for the folder currently open in the Brain. Rename is
 * an inline editable name; delete confirms first and — because the open folder
 * ceases to exist — routes back to "All items". Deleting a folder never deletes
 * its content (content_items.folder_id is `on delete set null`); the items fall
 * back to Unfiled.
 */
export function BrainFolderSettings({
  folder,
  itemCount,
}: {
  folder: { id: string; name: string; description: string | null };
  itemCount: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [renameState, renameAction, renamePending] = useActionState(renameFolder, initialRoutineState);
  const [delState, delAction, delPending] = useActionState(deleteFolder, initialRoutineState);

  const [handledRename, setHandledRename] = useState(renameState);
  if (renameState !== handledRename) {
    setHandledRename(renameState);
    if (renameState.status === "success") setEditing(false);
  }

  useEffect(() => {
    if (delState.status === "success") router.push("/admin/brain");
  }, [delState, router]);

  if (editing) {
    return (
      <form action={renameAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={folder.id} />
        <input
          name="name"
          required
          maxLength={80}
          defaultValue={folder.name}
          autoFocus
          className="border border-rule-border bg-transparent px-3 py-1.5 text-sm"
        />
        <input
          name="description"
          maxLength={500}
          defaultValue={folder.description ?? ""}
          placeholder="Optional description"
          className="border border-rule-border bg-transparent px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={renamePending}
          className="bg-brand-accent px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-foreground disabled:opacity-50"
        >
          {renamePending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-2 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted hover:text-foreground"
        >
          Cancel
        </button>
        {renameState.status === "error" && <span className="text-xs text-brand-accent-deep">{renameState.message}</span>}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="border border-rule-border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted hover:text-foreground"
      >
        Rename
      </button>
      <form
        action={delAction}
        onSubmit={(e) => {
          const msg =
            itemCount > 0
              ? `Delete the folder “${folder.name}”? Its ${itemCount} item${itemCount === 1 ? "" : "s"} won’t be deleted — they’ll move to Unfiled.`
              : `Delete the folder “${folder.name}”?`;
          if (!window.confirm(msg)) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={folder.id} />
        <button
          type="submit"
          disabled={delPending}
          className="border border-rule-border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep hover:bg-brand-accent hover:text-brand-accent-foreground disabled:opacity-50"
        >
          {delPending ? "…" : "Delete folder"}
        </button>
      </form>
      {delState.status === "error" && <span className="text-xs text-brand-accent-deep">{delState.message}</span>}
    </div>
  );
}
