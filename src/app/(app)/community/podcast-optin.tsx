"use client";

import { useActionState, useState } from "react";
import { updatePodcastGuestOptIn } from "@/lib/actions/community";
import { initialRoutineState } from "@/lib/actions/routineState";
import type { PodcastGuestAnonymityPreference } from "@/types/database";

const ANONYMITY_LABEL: Record<PodcastGuestAnonymityPreference, string> = {
  full_name: "Use my full name",
  first_name_only: "First name only",
  anonymous: "Keep me anonymous",
};

/**
 * "Podcast guest opt-in -- a way for users to express interest in sharing
 * their story on the monthly podcast. This feeds into a private list for
 * Anthony to review, not a public sign-up" (brief). The private list itself
 * is src/app/admin/podcast.
 *
 * Consent process (brief, "required before recording" -- "protects the
 * guest and protects the platform legally"): a written explanation of
 * what's recorded/shared, an anonymity choice, and a standing right to
 * withdraw. The explanation and anonymity choice are collected here, at
 * the point of opting in -- see updatePodcastGuestOptIn's own doc comment
 * for why consent is re-stamped every time, not just once. The right to
 * review an episode before it airs is a production-side promise (there's
 * no recording/editing pipeline in this app to attach a button to) --
 * stated here as what happens next, not faked as an in-app step.
 */
export function PodcastOptIn({
  optedIn,
  anonymityPreference,
}: {
  optedIn: boolean;
  anonymityPreference: PodcastGuestAnonymityPreference | null;
}) {
  const [state, formAction, isPending] = useActionState(updatePodcastGuestOptIn, initialRoutineState);
  const [choice, setChoice] = useState<PodcastGuestAnonymityPreference | "">("");
  const [showConsent, setShowConsent] = useState(false);

  if (optedIn) {
    return (
      <form action={formAction} className="space-y-2 text-sm">
        <p className="font-semibold">You&apos;re on the podcast guest list</p>
        <p className="text-xs text-muted">
          Credited as: {anonymityPreference ? ANONYMITY_LABEL[anonymityPreference] : "not set"}. Anthony
          will reach out directly -- you&apos;ll get to review any episode before it airs, and you can
          withdraw at any time, including after it&apos;s published.
        </p>
        <input type="hidden" name="optIn" value="false" />
        <button
          type="submit"
          disabled={isPending}
          className="border border-rule-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
        >
          {isPending ? "…" : "Withdraw"}
        </button>
        {state.status === "error" && <p className="text-xs text-brand-accent-deep">{state.message}</p>}
      </form>
    );
  }

  if (!showConsent) {
    return (
      <div className="space-y-2 text-sm">
        <p className="font-semibold">Tell your story on the podcast</p>
        <p className="text-xs text-muted">Private -- only Anthony sees this list, never posted publicly.</p>
        <button
          type="button"
          onClick={() => setShowConsent(true)}
          className="border border-rule-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
        >
          I&apos;m interested
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3 text-sm">
      <p className="font-semibold">Before you opt in</p>
      <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
        <li>A conversation with Anthony gets recorded and shared as a podcast episode, publicly.</li>
        <li>You&apos;ll get to review the episode before it goes live.</li>
        <li>You can withdraw at any time -- including after it&apos;s published.</li>
        <li>Choose below how you&apos;d like to be credited.</li>
      </ul>

      <input type="hidden" name="optIn" value="true" />
      <fieldset className="space-y-1">
        <legend className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
          How should we credit you?
        </legend>
        {(Object.entries(ANONYMITY_LABEL) as [PodcastGuestAnonymityPreference, string][]).map(
          ([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-xs">
              <input
                type="radio"
                name="anonymityPreference"
                value={value}
                checked={choice === value}
                onChange={() => setChoice(value)}
                required
              />
              {label}
            </label>
          )
        )}
      </fieldset>

      {state.status === "error" && <p className="text-xs text-brand-accent-deep">{state.message}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || !choice}
          className="border border-rule-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
        >
          {isPending ? "…" : "I understand -- opt in"}
        </button>
        <button
          type="button"
          onClick={() => setShowConsent(false)}
          className="px-3 py-1.5 text-xs text-muted underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
