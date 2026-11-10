"use client";

import { useActionState, useEffect, useRef } from "react";
import { createRoutineAction } from "@/lib/actions/userRoutines";
import { initialRoutineState } from "@/lib/actions/routineState";
import { RoutineFields } from "./RoutineFields";

/**
 * Add a new routine: a name, the days it runs, and an optional time. The fields
 * are uncontrolled (native form state), so the form resets itself on a
 * successful add, ready for the next one.
 */
export function RoutineComposer() {
  const [state, action, pending] = useActionState(createRoutineAction, initialRoutineState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <RoutineFields idPrefix="new" />

      {state.status === "error" && (
        <p className="text-sm font-semibold text-brand-accent-deep">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-foreground px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-background disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add routine"}
      </button>
    </form>
  );
}
