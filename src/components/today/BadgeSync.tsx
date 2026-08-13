"use client";

import { useEffect, useRef, useState } from "react";
import { syncEarnedBadgesAction } from "@/lib/actions/gamification";

/**
 * Persists newly-earned badges on the Today load and, if any were just earned,
 * shows a one-time celebratory note. Renders nothing otherwise. The action does
 * all the real work server-side (re-derives + persists own-rows-only); this just
 * triggers it once on mount and surfaces the result. A ref guards the single
 * run so no state is set synchronously inside the effect.
 */
export function BadgeSync() {
  const ran = useRef(false);
  const [earned, setEarned] = useState<{ key: string; label: string }[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    syncEarnedBadgesAction().then((result) => {
      if (result.newlyEarned.length > 0) setEarned(result.newlyEarned);
    });
  }, []);

  if (dismissed || earned.length === 0) return null;

  const labels = earned.map((b) => b.label).join(", ");
  return (
    <div
      role="status"
      className="mb-4 flex items-center justify-between gap-3 border border-brand-accent px-4 py-2.5 text-sm"
    >
      <p className="font-semibold">
        <span aria-hidden="true">🎉 </span>
        New badge{earned.length > 1 ? "s" : ""} earned: {labels}
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 text-lg leading-none text-muted transition-colors hover:text-foreground"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
