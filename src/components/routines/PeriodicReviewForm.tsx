"use client";

import { useActionState } from "react";
import { submitPeriodicReview } from "@/lib/actions/periodicReview";
import { initialRoutineState } from "@/lib/actions/routineState";
import type { ReviewType, SelfAssessment } from "@/types/database";

const SELF_ASSESSMENT_DIMENSIONS: { key: keyof SelfAssessment; label: string }[] = [
  { key: "mindset", label: "Mindset" },
  { key: "energy", label: "Energy" },
  { key: "discipline", label: "Discipline" },
  { key: "relationships", label: "Relationships" },
  { key: "confidence", label: "Confidence" },
  { key: "overall", label: "Overall Progress" },
];

export function PeriodicReviewForm({
  reviewType,
  comparisonSelfAssessment,
}: {
  reviewType: ReviewType;
  /** 90-day only: the user's prior 30-day scores, for the delta view. */
  comparisonSelfAssessment?: SelfAssessment | null;
}) {
  const [state, formAction, isPending] = useActionState(submitPeriodicReview, initialRoutineState);
  const isNinetyDay = reviewType === "90_day";
  const periodLabel = isNinetyDay ? "90" : "30";
  const winCount = isNinetyDay ? 10 : 5;

  if (state.status === "success") {
    return (
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">You&apos;ve completed your {periodLabel} days.</h1>
        <p className="opacity-80">Keep on living.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="reviewType" value={reviewType} />

      <header className="space-y-3 text-center">
        <h1 className="text-2xl font-bold">Congratulations. You&apos;ve completed your {isNinetyDay ? "first 90" : "first 30"} days.</h1>
        <p className="opacity-80">
          The hardest part of any journey is getting started and staying consistent when
          motivation fades. Take a moment to recognise the effort you&apos;ve made so far.
        </p>
      </header>

      <div className="space-y-4">
        <label className="block text-sm">
          <span className="font-medium">
            Looking Back -- what am I most proud of from the last {periodLabel} days?
          </span>
          <textarea
            name="mostProudOf"
            rows={2}
            className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">What habits have I been most consistent with?</span>
          <textarea
            name="mostConsistentHabits"
            rows={2}
            className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">What challenges have I faced?</span>
          <textarea
            name="challengesFaced"
            rows={2}
            className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">What&apos;s working? What habits or behaviours are helping me move forward?</span>
          <textarea
            name="whatsWorking"
            rows={2}
            className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">What needs to change? What is holding me back?</span>
          <textarea
            name="needsToChange"
            rows={2}
            className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
          />
        </label>
      </div>

      {isNinetyDay && (
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="font-medium">What has changed in my life over the last 90 days?</span>
            <textarea
              name="lifeChanges"
              rows={2}
              className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">What do I want the next 90 days to look like?</span>
            <textarea
              name="nextPeriodVision"
              rows={2}
              className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
            />
          </label>
        </div>
      )}

      <fieldset className="space-y-2 text-sm">
        <legend className="mb-1 font-medium">My top {winCount} wins</legend>
        {Array.from({ length: winCount }, (_, i) => i + 1).map((n) => (
          <input
            key={n}
            name={`win_${n}`}
            type="text"
            placeholder={`Win ${n}`}
            className="w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
          />
        ))}
      </fieldset>

      <fieldset className="space-y-3 text-sm">
        <legend className="mb-1 font-medium">Self assessment -- rate yourself 1-10</legend>
        {SELF_ASSESSMENT_DIMENSIONS.map((dimension) => (
          <label key={dimension.key} className="flex items-center justify-between gap-3">
            <span>
              {dimension.label}
              {isNinetyDay && comparisonSelfAssessment && (
                <span className="ml-2 text-xs opacity-60">
                  (30-day: {comparisonSelfAssessment[dimension.key]})
                </span>
              )}
            </span>
            <input
              name={dimension.key}
              type="number"
              min={1}
              max={10}
              required
              className="w-16 rounded-md border border-white/20 bg-transparent px-2 py-1 text-center"
            />
          </label>
        ))}
      </fieldset>

      <label className="block text-sm">
        <span className="font-medium">My focus for the next {periodLabel} days</span>
        <textarea
          name="focusNextPeriod"
          rows={2}
          className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
        />
      </label>

      <div className="space-y-2 rounded-lg border border-white/10 p-4 text-sm">
        <p className="italic">
          &ldquo;I have completed {periodLabel} days. I will continue to show up, trust the
          process, and keep moving forward.&rdquo;
        </p>
        <label className="block">
          <span className="font-medium">Name</span>
          <input
            name="commitmentSignedName"
            type="text"
            required
            className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
          />
        </label>
      </div>

      {state.status === "error" && <p className="text-sm text-red-400">{state.message}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-brand-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isPending ? "Saving…" : `Complete ${periodLabel}-Day Review`}
      </button>
    </form>
  );
}
