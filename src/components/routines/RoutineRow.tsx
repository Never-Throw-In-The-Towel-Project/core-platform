"use client";

import { useActionState, useState } from "react";
import {
  updateRoutineAction,
  setRoutineActiveAction,
  deleteRoutineAction,
} from "@/lib/actions/userRoutines";
import { initialRoutineState, type RoutineActionState } from "@/lib/actions/routineState";
import { RoutineFields } from "./RoutineFields";
import { summariseWeekdays, formatRoutineTime } from "@/lib/routines/userRoutinesConfig";
import type { UserRoutine } from "@/types/database";

/**
 * One routine on the manage page: its name + day/time summary and the controls
 * to edit it inline, retire/restore it (keeps history), or delete it outright.
 * Edit uses the same shared fields as the composer, pre-filled.
 */
export function RoutineRow({ routine }: { routine: UserRoutine }) {
  const [editing, setEditing] = useState(false);
  // Wrap the update action so a successful save closes the editor. This runs in
  // the action transition (a user-initiated event), not an effect, so it's a
  // safe place to set state.
  const [editState, editAction, editPending] = useActionState(
    async (prev: RoutineActionState, formData: FormData): Promise<RoutineActionState> => {
      const res = await updateRoutineAction(prev, formData);
      if (res.status === "success") setEditing(false);
      return res;
    },
    initialRoutineState
  );
  const [, activeAction] = useActionState(setRoutineActiveAction, initialRoutineState);
  const [, deleteAction, deletePending] = useActionState(deleteRoutineAction, initialRoutineState);

  const time = formatRoutineTime(routine.time_of_day);

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={"font-extrabold leading-tight" + (routine.active ? "" : " text-muted line-through")}>
            {routine.label}
          </p>
          <p className="mt-1 text-sm text-muted">
            {summariseWeekdays(routine.weekdays)}
            {time ? ` · ${time}` : ""}
            {routine.active ? "" : " · retired"}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="border border-rule-border px-3 py-1.5 text-foreground transition-colors hover:border-foreground"
          >
            {editing ? "Close" : "Edit"}
          </button>

          <form action={activeAction}>
            <input type="hidden" name="id" value={routine.id} />
            <input type="hidden" name="active" value={routine.active ? "false" : "true"} />
            <button
              type="submit"
              className="border border-rule-border px-3 py-1.5 text-foreground transition-colors hover:border-foreground"
            >
              {routine.active ? "Retire" : "Restore"}
            </button>
          </form>

          <form
            action={deleteAction}
            onSubmit={(e) => {
              if (!confirm(`Delete “${routine.label}”? This also removes its tick history.`)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={routine.id} />
            <button
              type="submit"
              disabled={deletePending}
              className="border border-rule-border px-3 py-1.5 text-brand-accent-deep transition-colors hover:border-brand-accent-deep disabled:opacity-50"
            >
              Delete
            </button>
          </form>
        </div>
      </div>

      {editing && (
        <form action={editAction} className="mt-4 space-y-4 border-t border-rule-hairline pt-4">
          <input type="hidden" name="id" value={routine.id} />
          <RoutineFields
            idPrefix={`edit-${routine.id}`}
            initialLabel={routine.label}
            initialWeekdays={routine.weekdays}
            initialTime={formatRoutineTime(routine.time_of_day) ?? ""}
          />
          {editState.status === "error" && (
            <p className="text-sm font-semibold text-brand-accent-deep">{editState.message}</p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={editPending}
              className="bg-foreground px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-background disabled:opacity-50"
            >
              {editPending ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-3 py-2.5 text-sm font-semibold text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
