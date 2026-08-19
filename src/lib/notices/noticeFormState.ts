import type { NoticeFieldErrors } from "@/lib/notices/validation";

/**
 * Result shape for the Notice AUTHORING actions (createNotice / updateNotice).
 * Distinct from the app-wide RoutineActionState because it carries `fieldErrors`:
 * a per-field message map so the form can highlight the exact field(s) at fault
 * instead of one generic line. The form is controlled, so the submitted values
 * persist on the client across an error -- the server only needs to say WHICH
 * fields were wrong, not echo the values back. Mirrors EventFormState.
 */
export type NoticeFormState =
  | { status: "idle" }
  | { status: "error"; message?: string; fieldErrors?: NoticeFieldErrors }
  | { status: "success"; message?: string };

export const initialNoticeFormState: NoticeFormState = { status: "idle" };
