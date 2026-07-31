"use client";

import { useActionState } from "react";
import { updateTimezone } from "@/lib/actions/settings";
import { initialRoutineState } from "@/lib/actions/routineState";

// Intl.supportedValuesOf isn't in every TS lib.d.ts revision yet -- available
// at runtime (Node 22 / modern browsers), typed loosely here rather than
// widening the project's global lib target for one call site.
const TIMEZONES: string[] =
  typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];

export function TimezoneForm({ currentTimezone }: { currentTimezone: string }) {
  const [state, formAction, isPending] = useActionState(updateTimezone, initialRoutineState);

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-white/10 p-4">
      <div>
        <label htmlFor="timezone" className="text-sm font-medium">
          Your timezone
        </label>
        <p className="mt-1 text-xs opacity-60">
          Controls when your Morning/Night Routine switches over and which day today is for check-ins.
        </p>
      </div>
      <select
        id="timezone"
        name="timezone"
        defaultValue={currentTimezone}
        className="w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm"
      >
        {TIMEZONES.map((tz) => (
          <option key={tz} value={tz} className="bg-black">
            {tz}
          </option>
        ))}
      </select>
      {state.status === "error" && <p className="text-sm text-red-400">{state.message}</p>}
      {state.status === "success" && <p className="text-sm opacity-60">Saved.</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
