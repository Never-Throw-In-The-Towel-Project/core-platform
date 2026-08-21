"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
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

const RATING_SCALE = Array.from({ length: 10 }, (_, i) => i + 1);

const PERIOD_LABEL: Record<ReviewType, string> = { "30_day": "30", "60_day": "60", "90_day": "90" };
const SUMMARY_HREF: Record<ReviewType, string> = {
  "30_day": "/reviews/30-day/summary",
  "60_day": "/reviews/60-day/summary",
  "90_day": "/reviews/90-day/summary",
};

export function PeriodicReviewForm({
  reviewType,
  comparisonSelfAssessment,
}: {
  reviewType: ReviewType;
  /** 60- and 90-day: the user's prior 30-day scores, for the delta view. */
  comparisonSelfAssessment?: SelfAssessment | null;
}) {
  const [state, formAction, isPending] = useActionState(submitPeriodicReview, initialRoutineState);
  const [ratings, setRatings] = useState<Partial<Record<keyof SelfAssessment, number>>>({});
  const isNinetyDay = reviewType === "90_day";
  const isSixtyDay = reviewType === "60_day";
  // Both the 60- and 90-day reviews compare against the 30-day baseline scores.
  const hasComparison = isNinetyDay || isSixtyDay;
  const periodLabel = PERIOD_LABEL[reviewType];
  const winCount = isNinetyDay ? 10 : 5;
  const now = new Date();
  const today = [now.getDate(), now.getMonth() + 1, now.getFullYear() % 100]
    .map((n) => String(n).padStart(2, "0"))
    .join(".");

  if (state.status === "success") {
    const summaryHref = SUMMARY_HREF[reviewType];
    return (
      <div className="mx-auto max-w-xl space-y-6 px-6 py-16 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">You&apos;ve completed your {periodLabel} days.</h1>
        <p className="text-muted">Keep on living.</p>
        <div className="flex flex-col items-center gap-3 pt-2">
          <Link
            href={summaryHref}
            className="w-full max-w-xs bg-brand-accent px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground"
          >
            See your summary →
          </Link>
          <Link href="/journey" className="text-sm font-semibold text-brand-accent-deep underline">
            Back to My Journey
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="reviewType" value={reviewType} />

      <div className="bg-brand-accent px-6 py-10 text-brand-accent-foreground">
        <div className="mx-auto max-w-xl">
          <p className="text-xs font-semibold tracking-wide uppercase opacity-90">
            Day {periodLabel} · Unlocked today
          </p>
          <h1 className="mt-2 text-3xl font-extrabold uppercase">
            Congratulations. You&apos;ve completed your first {periodLabel} days.
          </h1>
          <p className="mt-4 opacity-90">
            The hardest part of any journey is getting started and staying consistent when
            motivation fades. Take a moment to recognise the effort you&apos;ve made so far.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-xl space-y-8 px-6 py-10">
        <div>
          <p className="text-xs font-semibold tracking-wide uppercase text-muted">Looking back</p>
          <div className="mt-2 space-y-4">
            <Field
              name="mostProudOf"
              label={`What am I most proud of from the last ${periodLabel} days?`}
            />
            <Field name="mostConsistentHabits" label="What habits have I been most consistent with?" />
            <Field name="challengesFaced" label="What challenges have I faced?" />
            <Field
              name="whatsWorking"
              label="What's working? What habits or behaviours are helping me move forward?"
            />
            <Field name="needsToChange" label="What needs to change? What is holding me back?" />
          </div>
        </div>

        {isNinetyDay && (
          <div>
            <p className="text-xs font-semibold tracking-wide uppercase text-muted">The last quarter</p>
            <div className="mt-2 space-y-4">
              <Field name="lifeChanges" label="What has changed in my life over the last 90 days?" />
              <Field name="nextPeriodVision" label="What do I want the next 90 days to look like?" />
            </div>
          </div>
        )}

        {isSixtyDay && (
          <div>
            <p className="text-xs font-semibold tracking-wide uppercase text-muted">The halfway mark</p>
            <div className="mt-2 space-y-4">
              <Field name="progressSinceStart" label="What progress have I made since day one?" />
              <Field name="learnedAboutMyself" label="What have I learned about myself?" />
              <Field name="identityBecoming" label="Identity check: who am I becoming?" />
            </div>
          </div>
        )}

        <fieldset>
          <legend className="text-xs font-semibold tracking-wide uppercase text-muted">My top {winCount} wins</legend>
          <div className="mt-2">
            {Array.from({ length: winCount }, (_, i) => i + 1).map((n) => (
              <div key={n} className="flex items-center gap-3 border-t border-rule-hairline py-2">
                <span className="text-sm font-semibold text-brand-accent">{n}</span>
                <input
                  name={`win_${n}`}
                  type="text"
                  placeholder="Add a win"
                  className="flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted"
                />
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-semibold tracking-wide uppercase text-muted">Self assessment</legend>
          <p className="mt-2 text-sm text-muted">
            Rate yourself 1–10.{hasComparison ? " Compared against your 30-day scores." : " You'll compare these against your later reviews."}
          </p>
          <div className="mt-3 space-y-3">
            {SELF_ASSESSMENT_DIMENSIONS.map((dimension) => (
              <div
                key={dimension.key}
                className="flex flex-col gap-2 border-t border-rule-hairline py-3 first:border-t-0 sm:flex-row sm:items-center sm:gap-3 sm:border-t-0 sm:py-0"
              >
                <span className="text-sm font-medium sm:w-32 sm:shrink-0">
                  {dimension.label}
                  {hasComparison && comparisonSelfAssessment && (
                    <span className="block text-xs font-normal text-muted">
                      30-day: {comparisonSelfAssessment[dimension.key]}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 gap-1">
                    {RATING_SCALE.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRatings((prev) => ({ ...prev, [dimension.key]: n }))}
                        className={
                          "h-8 flex-1 sm:h-6 " +
                          ((ratings[dimension.key] ?? 0) >= n ? "bg-brand-accent" : "bg-foreground/10")
                        }
                        aria-label={`${dimension.label}: ${n}`}
                      />
                    ))}
                  </div>
                  <span className="w-6 shrink-0 text-right text-sm font-semibold">
                    {ratings[dimension.key] ?? "–"}
                  </span>
                </div>
                <input type="hidden" name={dimension.key} value={ratings[dimension.key] ?? ""} />
              </div>
            ))}
          </div>
        </fieldset>

        {/* The forward focus always looks to the NEXT milestone: 30-day and
            60-day both aim at the next 30 days (the 60-day reaches day 90),
            the 90-day sets the next 90. */}
        <Field name="focusNextPeriod" label={`My focus for the next ${isNinetyDay ? "90" : "30"} days`} />

        <div className="border border-rule-border p-4">
          <p className="italic">
            &ldquo;I have completed {periodLabel} days. I will continue to show up, trust the
            process, and keep moving forward.&rdquo;
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold tracking-wide uppercase text-muted">Name</span>
              <input
                name="commitmentSignedName"
                type="text"
                required
                className="mt-1 w-full border-b border-rule-border bg-transparent py-1"
              />
            </label>
            <div>
              <span className="text-xs font-semibold tracking-wide uppercase text-muted">Date</span>
              <p className="mt-1 border-b border-rule-border py-1">{today}</p>
            </div>
          </div>
          {state.status === "error" && <p className="mt-3 text-sm text-brand-accent-deep">{state.message}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="mt-4 w-full bg-brand-accent px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
          >
            {isPending ? "Saving…" : `Sign and save my ${periodLabel} days →`}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({ name, label }: { name: string; label: string }) {
  return (
    <label className="block border-t border-rule-hairline pt-4 text-sm">
      <span className="font-medium">{label}</span>
      <textarea name={name} rows={2} className="mt-2 w-full border border-rule-border bg-transparent px-3 py-2" />
    </label>
  );
}
