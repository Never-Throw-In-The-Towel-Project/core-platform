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
 * (showAccept=false there once already opted in). Restyled to the Modernist
 * system: an eyebrow + bold heading, numbered flat rule cards (deep-red
 * numerals), and a flat accent CTA.
 */
export function CommunityGuidelines({ showAccept }: { showAccept: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mx-auto max-w-xl px-6 py-14">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-deep">
        Before you post
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Community Guidelines</h1>
      <ol className="mt-6 space-y-3">
        {GUIDELINES.map((rule, i) => (
          <li key={rule} className="flex gap-3 border border-rule-border p-4 text-sm">
            <span className="font-extrabold tabular-nums text-brand-accent-deep" aria-hidden="true">
              {i + 1}
            </span>
            <span>{rule}</span>
          </li>
        ))}
      </ol>
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
