import type { EventFieldErrors } from "@/lib/events/validation";

/**
 * Result shape for the event AUTHORING actions (createEvent / updateEvent /
 * createCompanyEvent). Distinct from the app-wide RoutineActionState because it
 * carries `fieldErrors`: a per-field message map so the form can highlight the
 * exact field(s) at fault instead of one generic line. The form itself is
 * controlled, so the submitted values persist on the client across an error --
 * the server only needs to say WHICH fields were wrong, not echo the values back.
 */
export type EventFormState =
  | { status: "idle" }
  | { status: "error"; message?: string; fieldErrors?: EventFieldErrors }
  | { status: "success"; message?: string };

export const initialEventFormState: EventFormState = { status: "idle" };
