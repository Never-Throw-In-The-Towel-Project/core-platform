"use client";

import { useActionState } from "react";
import { updateNotificationTimes } from "@/lib/actions/settings";
import { initialRoutineState } from "@/lib/actions/routineState";

/** Postgres `time` comes back as "HH:MM:SS" -- <input type="time"> wants "HH:MM". */
function toHHMM(value: string | null, fallback: string) {
  return (value ?? fallback).slice(0, 5);
}

export function NotificationTimesForm({
  morningTime,
  nightTime,
  sundayTime,
}: {
  morningTime: string | null;
  nightTime: string | null;
  sundayTime: string | null;
}) {
  const [state, formAction, isPending] = useActionState(
    updateNotificationTimes,
    initialRoutineState
  );

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-black/10 p-4">
      <div>
        <p className="text-sm font-medium">Reminder times</p>
        <p className="mt-1 text-xs opacity-60">You choose when the platform speaks to you.</p>
      </div>

      <TimeField
        name="morningTime"
        label="Morning routine"
        defaultValue={toHHMM(morningTime, "07:00")}
      />
      <TimeField name="nightTime" label="Night routine" defaultValue={toHHMM(nightTime, "21:00")} />
      <TimeField name="sundayTime" label="Sunday setup" defaultValue={toHHMM(sundayTime, "18:00")} />

      {state.status === "error" && <p className="text-sm text-red-700">{state.message}</p>}
      {state.status === "success" && <p className="text-sm opacity-60">Saved.</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-brand-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

function TimeField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <label htmlFor={name} className="text-sm">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="time"
        required
        defaultValue={defaultValue}
        className="rounded-md border border-black/20 bg-transparent px-3 py-2 text-sm font-semibold"
      />
    </div>
  );
}
