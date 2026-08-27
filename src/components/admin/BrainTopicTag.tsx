"use client";

import { useState, useTransition } from "react";
import { backfillTopicsAction } from "@/lib/actions/brainTopics";

/**
 * "Auto-tag topics with AI" — the one-time backfill that tags the existing
 * library against the member topic taxonomy (Addiction, Divorce, Grief, …).
 * Loops the bounded server action across the whole library so the operator
 * clicks once; new uploads are tagged automatically on import, so this is only
 * for catching up what's already here. Mirrors the "Sync entire Vimeo library"
 * loop UX and the light admin-tool tokens.
 */

// 300 pages × 20 = up to 6000 items per click; a bigger library finishes on a
// second click. A hard bound so a runaway offset can't loop forever.
const MAX_RUNS = 300;

export function BrainTopicTag({ aiConfigured }: { aiConfigured: boolean }) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [tone, setTone] = useState<"muted" | "ok" | "error">("muted");

  function run() {
    setNote(null);
    startTransition(async () => {
      let offset = 0;
      let scanned = 0;
      let tagged = 0;
      let total = 0;
      for (let i = 0; i < MAX_RUNS; i++) {
        const res = await backfillTopicsAction({ offset });
        if (res.status === "error") {
          setTone("error");
          setNote(scanned > 0 ? `Tagged ${tagged} across ${scanned} before an error: ${res.message}` : res.message);
          return;
        }
        scanned += res.scanned;
        tagged += res.tagged;
        total = res.total;
        offset = res.nextOffset;
        setTone("ok");
        setNote(
          res.done
            ? `Done — scanned ${scanned} item${scanned === 1 ? "" : "s"}, tagged ${tagged} with topics.`
            : `Tagging… ${scanned}/${total} scanned, ${tagged} tagged so far.`
        );
        if (res.done || res.scanned === 0) return;
      }
      setTone("ok");
      setNote(`Scanned ${scanned}, tagged ${tagged}. Big library — click again to continue.`);
    });
  }

  return (
    <div className="border border-rule-border p-5">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
        Auto-tag topics with AI
        <span className="ml-2 font-semibold normal-case tracking-normal text-muted">
          — sort the whole library into the Library’s topic rooms (Addiction, Divorce, Grief…)
        </span>
      </p>
      {aiConfigured ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="bg-brand-accent px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground transition-colors hover:bg-brand-accent-deep disabled:opacity-50"
          >
            {pending ? "Tagging…" : "Auto-tag topics"}
          </button>
          <span className="text-xs text-muted">
            New uploads are tagged automatically on import — this catches up what’s already here.
          </span>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Connect <span className="font-semibold">ANTHROPIC_API_KEY</span> in the deployment to enable AI topic
          tagging.
        </p>
      )}
      {note && (
        <p
          className={`mt-3 text-sm font-semibold ${tone === "error" ? "text-brand-accent-deep" : "text-foreground"}`}
          role="status"
        >
          {note}
        </p>
      )}
    </div>
  );
}
