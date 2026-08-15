"use client";

import { useActionState, useState } from "react";
import { createFolder } from "@/lib/actions/contentFolders";
import { initialRoutineState } from "@/lib/actions/routineState";

const FIELD = "w-full border border-rule-border bg-transparent px-3 py-2 text-sm";

/**
 * The Brain sidebar's "New folder" affordance: a toggle that reveals an inline
 * create form (createFolder). Inputs are controlled so a successful create can
 * clear them and collapse the form during render (React's documented reset
 * pattern, same as ContentStudioForm) — no ref access, no effect. The server
 * revalidates so the new folder appears in the sidebar.
 */
export function BrainFolderCreate() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [state, action, pending] = useActionState(createFolder, initialRoutineState);

  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state.status === "success") {
      setName("");
      setDescription("");
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full border border-rule-border px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep transition-colors hover:bg-foreground/[0.03]"
      >
        + New folder
      </button>
    );
  }

  return (
    <form action={action} className="space-y-2 border border-rule-border p-3">
      <label htmlFor="folder-name" className="block text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
        Folder name
      </label>
      <input
        id="folder-name"
        name="name"
        required
        maxLength={80}
        autoFocus
        placeholder="e.g. Sleep"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={FIELD}
      />
      <input
        name="description"
        maxLength={500}
        placeholder="Optional description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className={FIELD}
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-accent px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-foreground disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add folder"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-2 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      {state.status === "error" && <p className="text-xs text-brand-accent-deep">{state.message}</p>}
    </form>
  );
}
