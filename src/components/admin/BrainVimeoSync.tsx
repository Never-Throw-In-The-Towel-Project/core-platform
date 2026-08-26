"use client";

import { useState, useTransition } from "react";
import { syncVimeoLibraryAction } from "@/lib/actions/vimeoImport";

/**
 * "Sync entire Vimeo library" — the one-click bulk import. Pulls every video not
 * already on the platform, AI-categorises it and publishes it live, then keeps
 * going until the whole backlog is in (each server call imports a bounded batch
 * and reports whether more remain; this loops through them so the operator
 * clicks once). The same engine runs hourly on its own, so this is really just
 * "don't wait for the next cron tick."
 */

// Safety cap on the auto-continue loop: 50 batches × 40 = up to 2000 videos per
// click. A library bigger than that finishes on the next click (or the cron).
const MAX_RUNS = 50;

export function BrainVimeoSync() {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [tone, setTone] = useState<"muted" | "ok" | "error">("muted");

  function run() {
    setNote(null);
    startTransition(async () => {
      let total = 0;
      for (let i = 0; i < MAX_RUNS; i++) {
        const res = await syncVimeoLibraryAction();
        if (res.status === "not_configured") {
          setTone("error");
          setNote("Vimeo isn’t connected yet — set vimeo_access_token in the deployment, then try again.");
          return;
        }
        if (res.status === "error") {
          setTone("error");
          setNote(total > 0 ? `Imported ${total} before Vimeo errored: ${res.message}` : res.message);
          return;
        }
        total += res.imported;
        setTone("ok");
        setNote(
          res.more ? `Importing… ${total} so far.` : doneMessage(total)
        );
        // Stop when nothing remains, or a batch moved nothing (avoids a hot loop
        // if 'more' is reported but every candidate failed to insert).
        if (!res.more || res.imported === 0) return;
      }
      setTone("ok");
      setNote(`Imported ${total}. That’s a big library — click again to bring in the rest.`);
    });
  }

  return (
    <div className="border border-rule-border p-5">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
        Sync entire Vimeo library
        <span className="ml-2 font-semibold normal-case tracking-normal text-muted">
          — one click; every video imported, categorised by AI and published live
        </span>
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="bg-brand-accent px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground transition-colors hover:bg-brand-accent-deep disabled:opacity-50"
        >
          {pending ? "Syncing…" : "Sync entire Vimeo library"}
        </button>
        <span className="text-xs text-muted">
          New uploads also flow in automatically every hour — this just pulls them now.
        </span>
      </div>
      {note && (
        <p
          className={`mt-3 text-sm font-semibold ${
            tone === "error" ? "text-brand-accent-deep" : "text-foreground"
          }`}
          role="status"
        >
          {note}
        </p>
      )}
    </div>
  );
}

function doneMessage(total: number): string {
  if (total === 0) return "Already up to date — nothing new to import.";
  return `Done — imported ${total} new video${total === 1 ? "" : "s"} and published them live.`;
}
