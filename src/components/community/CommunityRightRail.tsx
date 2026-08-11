import Link from "next/link";
import { DisplayNameForm } from "./DisplayNameForm";

/** The right rail from the design reference -- guidelines and your own display name, always in view alongside the feed. Restyled to the Modernist flat-card system. */
export function CommunityRightRail({ displayName }: { displayName: string }) {
  return (
    <aside className="space-y-6 text-sm">
      <div className="border border-rule-border p-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Guidelines</p>
        <p className="mt-2 text-muted">
          Talking is a strength, not a weakness. Keep it kind. What&apos;s shared here stays here. Report anything
          that doesn&apos;t sit right.
        </p>
        <Link
          href="/community/guidelines"
          className="mt-2 inline-block text-xs font-bold uppercase tracking-wide text-brand-accent-deep"
        >
          Read the full guidelines →
        </Link>
      </div>

      <div className="border border-rule-border p-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Your display name</p>
        <div className="mt-2">
          <DisplayNameForm currentName={displayName} />
        </div>
      </div>
    </aside>
  );
}
