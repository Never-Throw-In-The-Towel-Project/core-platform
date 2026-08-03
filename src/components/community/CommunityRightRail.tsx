import Link from "next/link";
import { DisplayNameForm } from "./DisplayNameForm";

/** The right rail from the design reference -- guidelines and your own display name, always in view alongside the feed. */
export function CommunityRightRail({ displayName }: { displayName: string }) {
  return (
    <aside className="space-y-6 text-sm">
      <div className="border border-current/10 p-3">
        <p className="text-xs font-semibold tracking-wide uppercase opacity-60">Guidelines</p>
        <p className="mt-2 opacity-80">
          Talking is a strength, not a weakness. Keep it kind. What&apos;s shared here stays here. Report anything
          that doesn&apos;t sit right.
        </p>
        <Link href="/community/guidelines" className="mt-2 inline-block text-brand-accent underline">
          Read the full guidelines
        </Link>
      </div>

      <div className="border border-current/10 p-3">
        <p className="text-xs font-semibold tracking-wide uppercase opacity-60">Your display name</p>
        <div className="mt-2">
          <DisplayNameForm currentName={displayName} />
        </div>
      </div>
    </aside>
  );
}
