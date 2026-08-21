// Shared result shape for every daily-routine/check-in server action --
// Morning, Night, the themed weekday check-ins, and Set Up Sunday all follow
// the same submit-and-report-back shape as lib/actions/support.ts.
export type RoutineActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message?: string };

export const initialRoutineState: RoutineActionState = { status: "idle" };
