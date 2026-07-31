"use client";

import { useTransition } from "react";
import { acceptCommunityGuidelines } from "@/lib/actions/community";

const GUIDELINES = [
  "Be kind. This is a space for encouragement, wins, and honest reflection -- not judgement.",
  "You don't have to use your real name, but stand behind what you post.",
  "No harassment, hate speech, or targeting anyone by name.",
  "This isn't a substitute for support -- if you need someone to check in with you, use the Ask for Support button.",
  "Report anything that doesn't belong here. The NTITT team reviews every report.",
];

/**
 * "Community guidelines displayed on first visit and accessible any time"
 * (brief) -- rendered both as the first-visit gate (showAccept=true, from
 * the community pages) and standalone at /community/guidelines
 * (showAccept=false there once already opted in).
 */
export function CommunityGuidelines({ showAccept }: { showAccept: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
      <h1 className="text-2xl font-bold">Community Guidelines</h1>
      <ul className="space-y-2 text-left text-sm opacity-80">
        {GUIDELINES.map((rule) => (
          <li key={rule} className="rounded-lg border border-white/10 p-3">
            {rule}
          </li>
        ))}
      </ul>
      {showAccept && (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await acceptCommunityGuidelines();
            })
          }
          className="rounded-md bg-brand-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isPending ? "…" : "I've read this -- take me to the community"}
        </button>
      )}
    </div>
  );
}
