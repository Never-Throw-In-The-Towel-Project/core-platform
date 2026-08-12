"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  addChallengeDay,
  deleteChallengeDay,
  setChallengePublished,
} from "@/lib/actions/challenges";
import { initialRoutineState } from "@/lib/actions/routineState";

const LABEL = "block text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted";
const FIELD = "mt-1 w-full border border-rule-border bg-transparent px-3 py-2 text-sm";

export interface AuthoringDay {
  id: string;
  day_index: number;
  prompt: string | null;
  content_title: string | null;
}

export interface ContentOption {
  id: string;
  title: string;
  is_published: boolean;
}

/**
 * The authoring surface for one challenge: publish/unpublish, add a day (pick a
 * spine item and/or write a prompt), and remove days. ntitt_admin only; every
 * action is re-authorised server-side and by RLS. Publishing is deliberate and
 * reversible -- a draft stays invisible to members until it's ready.
 */
export function ChallengeAuthoring({
  challengeId,
  isPublished,
  days,
  contentOptions,
  nextDayIndex,
}: {
  challengeId: string;
  isPublished: boolean;
  days: AuthoringDay[];
  contentOptions: ContentOption[];
  nextDayIndex: number;
}) {
  const [publishState, publishAction, publishPending] = useActionState(setChallengePublished, initialRoutineState);
  const [addState, addAction, addPending] = useActionState(addChallengeDay, initialRoutineState);
  const addFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (addState.status === "success") addFormRef.current?.reset();
  }, [addState]);

  return (
    <div className="space-y-8">
      {/* Publish state */}
      <form action={publishAction} className="flex items-center gap-3 border border-rule-border p-4">
        <input type="hidden" name="challengeId" value={challengeId} />
        <input type="hidden" name="publish" value={isPublished ? "false" : "true"} />
        <span
          className={
            "border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] " +
            (isPublished ? "border-rule-border text-muted" : "border-brand-accent bg-brand-accent text-brand-accent-foreground")
          }
        >
          {isPublished ? "Live" : "Draft"}
        </span>
        <button
          type="submit"
          disabled={publishPending}
          className="text-sm font-extrabold uppercase tracking-wide underline underline-offset-2 hover:text-brand-accent-deep disabled:opacity-50"
        >
          {publishPending ? "Saving…" : isPublished ? "Unpublish" : "Publish"}
        </button>
        {publishState.status === "error" && <span className="text-sm text-brand-accent-deep">{publishState.message}</span>}
      </form>

      {/* Add a day */}
      <form ref={addFormRef} action={addAction} className="space-y-4 border border-rule-border p-5">
        <input type="hidden" name="challengeId" value={challengeId} />
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Add a day</h3>
        <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
          <div>
            <label htmlFor="day-index" className={LABEL}>
              Day
            </label>
            <input
              id="day-index"
              name="dayIndex"
              type="number"
              min={1}
              max={366}
              defaultValue={nextDayIndex}
              required
              inputMode="numeric"
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="day-content" className={LABEL}>
              Content <span className="font-semibold normal-case tracking-normal text-muted">(optional)</span>
            </label>
            <select id="day-content" name="contentItemId" defaultValue="" className={FIELD}>
              <option value="">No content — prompt only</option>
              {contentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                  {c.is_published ? "" : " (draft)"}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="day-prompt" className={LABEL}>
            Prompt <span className="font-semibold normal-case tracking-normal text-muted">(optional)</span>
          </label>
          <textarea id="day-prompt" name="prompt" rows={2} maxLength={1000} className={`${FIELD} resize-y`} />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={addPending}
            className="bg-brand-accent px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
          >
            {addPending ? "Adding…" : "Add day"}
          </button>
          {addState.status === "error" && <p className="text-sm text-brand-accent-deep">{addState.message}</p>}
          {addState.status === "success" && (
            <p className="text-sm font-semibold text-foreground" role="status">
              Added.
            </p>
          )}
        </div>
      </form>

      {/* Existing days */}
      <div>
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Days ({days.length})</h3>
        {days.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No days yet — add the first above.</p>
        ) : (
          <ul className="mt-3 divide-y divide-rule-hairline border-t border-rule-hairline">
            {days.map((day) => (
              <li key={day.id} className="flex items-center gap-3 py-3">
                <span className="w-14 shrink-0 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
                  Day {day.day_index}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-extrabold leading-tight tracking-tight">
                    {day.content_title ?? "Prompt only"}
                  </span>
                  {day.prompt && <span className="mt-0.5 block truncate text-xs text-muted">{day.prompt}</span>}
                </span>
                <DeleteDayButton challengeId={challengeId} dayId={day.id} dayIndex={day.day_index} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DeleteDayButton({ challengeId, dayId, dayIndex }: { challengeId: string; dayId: string; dayIndex: number }) {
  const [state, action, pending] = useActionState(deleteChallengeDay, initialRoutineState);
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="challengeId" value={challengeId} />
      <input type="hidden" name="dayId" value={dayId} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`Remove day ${dayIndex}`}
        className="text-xs font-semibold uppercase tracking-wide text-muted underline underline-offset-2 hover:text-brand-accent-deep disabled:opacity-50"
      >
        {pending ? "…" : "Remove"}
      </button>
      {state.status === "error" && <span className="sr-only">{state.message}</span>}
    </form>
  );
}
