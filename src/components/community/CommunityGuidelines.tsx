"use client";

import { useTransition } from "react";
import { acceptCommunityGuidelines } from "@/lib/actions/community";
import { GuidelinesList } from "./GuidelinesList";

/**
 * The community-guidelines first-visit accept gate: shown inline on the feed and
 * wins board when the member hasn't opted in yet (showAccept=true), with the
 * accept button that flips community_opt_in. The read-only version of the same
 * guidelines lives in Settings (GuidelinesList) -- both share the copy in
 * lib/community/guidelines.ts.
 */
export function CommunityGuidelines({ showAccept }: { showAccept: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mx-auto max-w-xl px-6 py-14">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-deep">
        Before you post
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Community Guidelines</h1>
      <div className="mt-6">
        <GuidelinesList />
      </div>
      {showAccept && (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await acceptCommunityGuidelines();
            })
          }
          className="mt-6 w-full bg-brand-accent px-5 py-3.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground transition-colors hover:bg-brand-accent-deep disabled:opacity-50 sm:w-auto"
        >
          {isPending ? "…" : "I've read this -- take me to the community"}
        </button>
      )}
    </div>
  );
}
