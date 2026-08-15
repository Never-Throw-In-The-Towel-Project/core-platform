"use client";

import { useActionState } from "react";
import { shareBadgeAction } from "@/lib/actions/community";
import { initialRoutineState } from "@/lib/actions/routineState";

/**
 * The member's conscious "share this badge" control on their Journey. Badges are
 * private by default; this is the only path that surfaces one to the community
 * wins board (brief §3). On success the server action revalidates /journey, so
 * the row re-renders as "Shared" -- this button only shows for a not-yet-shared
 * badge when the member has joined the community.
 */
export function ShareBadgeButton({ badgeKey, onDark = false }: { badgeKey: string; onDark?: boolean }) {
  const [state, formAction, pending] = useActionState(shareBadgeAction, initialRoutineState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="badgeKey" value={badgeKey} />
      <button
        type="submit"
        disabled={pending}
        className={`text-xs font-semibold underline-offset-2 hover:underline disabled:opacity-50 ${
          onDark ? "text-brand-accent-light" : "text-brand-accent"
        }`}
      >
        {pending ? "Sharing…" : "Share →"}
      </button>
      {state.status === "error" ? (
        <span className={`text-xs ${onDark ? "text-brand-accent-light" : "text-brand-accent-deep"}`}>{state.message}</span>
      ) : null}
    </form>
  );
}
