"use client";

import Link from "next/link";
import { useActionState } from "react";
import { enrollInChallenge, leaveChallenge, setChallengeDayDone } from "@/lib/actions/challenges";
import { initialRoutineState } from "@/lib/actions/routineState";
import type { ContentType } from "@/types/database";

export interface ChallengeDayView {
  id: string;
  day_index: number;
  prompt: string | null;
  content: { id: string; title: string; type: ContentType } | null;
}

const CONTENT_VERB: Record<ContentType, string> = { video: "Watch", document: "Read", image: "View" };

/**
 * The interactive half of a challenge detail page: join/leave, and tick days as
 * you finish them. Completion state is driven entirely by `completedIds` from
 * the server (each action revalidates the route), so what's ticked is always
 * the source of truth after a round-trip -- no optimistic local state to drift.
 * Ticking is only offered once enrolled; browsing the content never requires it.
 */
export function ChallengeExperience({
  challengeId,
  enrolled,
  days,
  completedIds,
}: {
  challengeId: string;
  enrolled: boolean;
  days: ChallengeDayView[];
  completedIds: string[];
}) {
  const [enrollState, enrollAction, enrollPending] = useActionState(enrollInChallenge, initialRoutineState);
  const [leaveState, leaveAction, leavePending] = useActionState(leaveChallenge, initialRoutineState);
  const completed = new Set(completedIds);

  return (
    <div>
      {/* Join / leave */}
      {!enrolled ? (
        <form action={enrollAction}>
          <input type="hidden" name="challengeId" value={challengeId} />
          <button
            type="submit"
            disabled={enrollPending}
            className="bg-brand-accent px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
          >
            {enrollPending ? "Joining…" : "Join this challenge"}
          </button>
          {enrollState.status === "error" && (
            <p className="mt-2 text-sm text-brand-accent-deep">{enrollState.message}</p>
          )}
        </form>
      ) : (
        <form action={leaveAction} className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground">You’re in — tick each day as you go.</span>
          <button
            type="submit"
            disabled={leavePending}
            className="text-xs font-semibold uppercase tracking-wide text-muted underline underline-offset-2 hover:text-foreground disabled:opacity-50"
          >
            {leavePending ? "Leaving…" : "Leave"}
          </button>
          {leaveState.status === "error" && <span className="text-sm text-brand-accent-deep">{leaveState.message}</span>}
        </form>
      )}

      {/* Days */}
      <ol className="mt-6 border-t border-rule-hairline">
        {days.length === 0 ? (
          <li className="py-6 text-sm text-muted">The days for this challenge are being put together.</li>
        ) : (
          days.map((day) => (
            <li key={day.id} className="flex items-start gap-4 border-b border-rule-hairline py-4">
              <DayToggle
                challengeDayId={day.id}
                dayIndex={day.day_index}
                done={completed.has(day.id)}
                enrolled={enrolled}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Day {day.day_index}</p>
                {day.content ? (
                  <Link
                    href={`/content/${day.content.id}`}
                    className="mt-0.5 block font-extrabold leading-tight tracking-tight hover:text-brand-accent-deep"
                  >
                    {day.content.title}
                    <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent-deep">
                      {CONTENT_VERB[day.content.type]} →
                    </span>
                  </Link>
                ) : (
                  <p className="mt-0.5 font-extrabold leading-tight tracking-tight">Day {day.day_index}</p>
                )}
                {day.prompt && <p className="mt-1 text-sm text-muted">{day.prompt}</p>}
              </div>
            </li>
          ))
        )}
      </ol>
    </div>
  );
}

/**
 * A single day's completion toggle. It's a real submit button posting the
 * opposite of the current state; `done` comes from the server so the control
 * reflects committed truth. Disabled (not just styled) until the member has
 * joined, so you can't tick a challenge you haven't started.
 */
function DayToggle({
  challengeDayId,
  dayIndex,
  done,
  enrolled,
}: {
  challengeDayId: string;
  dayIndex: number;
  done: boolean;
  enrolled: boolean;
}) {
  const [state, action, pending] = useActionState(setChallengeDayDone, initialRoutineState);

  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="challengeDayId" value={challengeDayId} />
      <input type="hidden" name="done" value={done ? "false" : "true"} />
      <button
        type="submit"
        disabled={!enrolled || pending}
        aria-pressed={done}
        aria-label={done ? `Mark day ${dayIndex} not done` : `Mark day ${dayIndex} done`}
        className={
          "flex h-7 w-7 items-center justify-center border text-sm font-extrabold transition-colors " +
          (done
            ? "border-brand-accent bg-brand-accent text-brand-accent-foreground"
            : "border-rule-border text-transparent hover:border-foreground") +
          (!enrolled ? " cursor-not-allowed opacity-40" : "")
        }
      >
        ✓
      </button>
      {state.status === "error" && <span className="sr-only">{state.message}</span>}
    </form>
  );
}
