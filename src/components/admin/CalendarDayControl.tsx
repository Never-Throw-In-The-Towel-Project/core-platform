"use client";

import { useActionState, useRef } from "react";
import { setContentItemDay } from "@/lib/actions/contentCalendar";
import { initialRoutineState } from "@/lib/actions/routineState";

const DAYS: { value: string; label: string }[] = [
  { value: "", label: "Any day" },
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
  { value: "7", label: "Sun" },
];

/**
 * Per-card weekday assignment for the distribution calendar. A <select> that
 * auto-submits to setContentItemDay ("" = Any day). On success the server
 * revalidates /admin/calendar, so a moved item drops from its old column and
 * appears in the new one. Mirrors BrainMoveControl's shape.
 */
export function CalendarDayControl({ itemId, day }: { itemId: string; day: number | null }) {
  const [state, action, pending] = useActionState(setContentItemDay, initialRoutineState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="flex items-center gap-1">
      <input type="hidden" name="itemId" value={itemId} />
      <label htmlFor={`day-${itemId}`} className="sr-only">
        Assign to day
      </label>
      <select
        id={`day-${itemId}`}
        name="day"
        defaultValue={day == null ? "" : String(day)}
        disabled={pending}
        onChange={() => formRef.current?.requestSubmit()}
        className="w-full border border-rule-border bg-transparent px-2 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted hover:text-foreground disabled:opacity-50"
      >
        {DAYS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>
      {state.status === "error" && <span className="text-[10px] text-brand-accent-deep">{state.message}</span>}
    </form>
  );
}
