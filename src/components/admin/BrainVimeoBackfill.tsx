"use client";

import { useState, useTransition } from "react";
import { backfillVimeoMetadataAction } from "@/lib/actions/vimeoImport";

/**
 * "Sync video metadata from Vimeo" — a one-click backfill for videos added by
 * hand (paste-an-ID) before Vimeo was connected, or before this integration
 * existed: fills their thumbnail, duration and private play hash. Renders only
 * when there are such videos; the action degrades if Vimeo isn't connected.
 */
export function BrainVimeoBackfill({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  if (count <= 0) return null;

  function run() {
    setNote(null);
    startTransition(async () => {
      const res = await backfillVimeoMetadataAction();
      if (res.status === "not_configured") {
        setNote("Connect Vimeo first (set vimeo_access_token), then try again.");
      } else if (res.status === "error") {
        setNote(res.message);
      } else {
        setNote(
          `Synced ${res.updated} video${res.updated === 1 ? "" : "s"}` +
            (res.failed > 0 ? ` · ${res.failed} couldn’t be matched on Vimeo` : "") +
            (res.remaining > 0 ? ` · ${res.remaining} left — run again` : "") +
            "."
        );
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="border border-rule-border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] transition-colors hover:border-brand-accent disabled:opacity-50"
      >
        {pending ? "Syncing…" : `Sync ${count} video${count === 1 ? "" : "s"} from Vimeo`}
      </button>
      <span className="text-xs text-muted">
        Fills thumbnails + durations for videos added before Vimeo was connected.
      </span>
      {note && (
        <span className="text-xs font-semibold text-foreground" role="status">
          {note}
        </span>
      )}
    </div>
  );
}
