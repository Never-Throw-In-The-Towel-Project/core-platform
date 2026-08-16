"use client";

import { useActionState, useRef } from "react";
import { scheduleContentItem } from "@/lib/actions/contentCalendar";
import { initialRoutineState } from "@/lib/actions/routineState";

/**
 * Set / clear a content item's publish date (Month view). Two modes:
 *   • "input"  — a date picker that auto-submits on change; used in the
 *     unscheduled-drafts panel (and to reschedule).
 *   • "clear"  — a lone "×" that unschedules; used on a calendar-cell chip.
 * Both post to scheduleContentItem; the server revalidates /admin/calendar.
 */
export function ScheduleControl({
  itemId,
  scheduledFor,
  mode = "input",
}: {
  itemId: string;
  scheduledFor: string | null;
  mode?: "input" | "clear";
}) {
  const [state, action, pending] = useActionState(scheduleContentItem, initialRoutineState);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (mode === "clear") {
    return (
      <form action={action} className="inline-flex">
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="date" value="" />
        <button
          type="submit"
          disabled={pending}
          aria-label="Unschedule"
          title="Unschedule"
          className="px-1 text-[11px] font-bold leading-none opacity-70 hover:opacity-100 disabled:opacity-50"
        >
          ×
        </button>
      </form>
    );
  }

  return (
    <form ref={formRef} action={action} className="flex items-center gap-1">
      <input type="hidden" name="itemId" value={itemId} />
      <label htmlFor={`sched-${itemId}`} className="sr-only">
        Schedule date
      </label>
      <input
        ref={inputRef}
        id={`sched-${itemId}`}
        type="date"
        name="date"
        defaultValue={scheduledFor ?? ""}
        disabled={pending}
        onChange={() => formRef.current?.requestSubmit()}
        className="border border-rule-border bg-transparent px-1.5 py-0.5 text-[11px] text-foreground disabled:opacity-50"
      />
      {scheduledFor && (
        <button
          type="button"
          onClick={() => {
            if (inputRef.current) inputRef.current.value = "";
            formRef.current?.requestSubmit();
          }}
          disabled={pending}
          className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted hover:text-foreground disabled:opacity-50"
        >
          Clear
        </button>
      )}
      {state.status === "error" && <span className="text-[10px] text-brand-accent-deep">{state.message}</span>}
    </form>
  );
}
