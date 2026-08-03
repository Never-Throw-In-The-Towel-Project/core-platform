"use client";

import { useActionState } from "react";
import { updatePodcastGuestOptIn } from "@/lib/actions/community";
import { initialRoutineState } from "@/lib/actions/routineState";

/**
 * "Podcast guest opt-in -- a way for users to express interest in sharing
 * their story on the monthly podcast. This feeds into a private list for
 * Anthony to review, not a public sign-up" (brief). Just a toggle -- the
 * private list itself is src/app/(app)/community/admin/podcast-guests.
 */
export function PodcastOptIn({ optedIn }: { optedIn: boolean }) {
  const [state, formAction, isPending] = useActionState(updatePodcastGuestOptIn, initialRoutineState);

  return (
    <form action={formAction} className="space-y-2 text-sm">
      <p className="font-medium">Tell your story on the podcast</p>
      <p className="text-xs opacity-60">Private -- only Anthony sees this list, never posted publicly.</p>
      <input type="hidden" name="optIn" value={String(!optedIn)} />
      <button
        type="submit"
        disabled={isPending}
        className="border border-current/20 px-3 py-1.5 text-xs font-semibold"
      >
        {isPending ? "…" : optedIn ? "Opted in ✓" : "I'm interested"}
      </button>
      {state.status === "error" && <p className="text-xs text-red-700">{state.message}</p>}
    </form>
  );
}
