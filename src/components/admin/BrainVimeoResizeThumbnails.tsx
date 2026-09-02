"use client";

import { useState, useTransition } from "react";
import { backfillVimeoMetadataAction } from "@/lib/actions/vimeoImport";

/**
 * "Re-fetch video thumbnails" — re-derives every video's still from Vimeo so an
 * existing catalogue adopts the current thumbnail-size policy (the Library stores
 * a ~640px still now, not Vimeo's 1280px "large"). New imports are already
 * right-sized; this is the one-time sweep for videos added before that change.
 *
 * One click walks the whole catalogue: the action pages by an id cursor and
 * hands back the next one, and this loops until there's none left — so it
 * finishes regardless of catalogue size while staying bounded (BACKFILL_LIMIT
 * outbound Vimeo calls per page, sequential, never a burst). Idempotent:
 * re-running just re-stores the same URLs.
 */
export function BrainVimeoResizeThumbnails({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  if (count <= 0) return null;

  function run() {
    setNote("Refreshing…");
    startTransition(async () => {
      let cursor: string | undefined;
      let updated = 0;
      let failed = 0;
      // Follow the action's cursor page by page. The guard is a safety bound
      // (BACKFILL_LIMIT × 1000 videos) so a bug can never spin forever.
      for (let guard = 0; guard < 1000; guard++) {
        const res = await backfillVimeoMetadataAction({ mode: "refresh", cursor });
        if (res.status === "not_configured") {
          setNote("Connect Vimeo first (set vimeo_access_token), then try again.");
          return;
        }
        if (res.status === "error") {
          setNote(res.message);
          return;
        }
        updated += res.updated;
        failed += res.failed;
        if (!res.nextCursor) break;
        cursor = res.nextCursor;
      }
      setNote(
        `Refreshed ${updated} thumbnail${updated === 1 ? "" : "s"}` +
          (failed > 0 ? ` · ${failed} couldn’t be matched on Vimeo` : "") +
          "."
      );
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
        {pending ? "Refreshing…" : "Re-fetch video thumbnails"}
      </button>
      <span className="text-xs text-muted">
        Re-pulls every video&apos;s poster from Vimeo at the current (smaller) size.
      </span>
      {note && (
        <span className="text-xs font-semibold text-foreground" role="status">
          {note}
        </span>
      )}
    </div>
  );
}
