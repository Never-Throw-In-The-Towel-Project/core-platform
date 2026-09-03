"use client";

import { useActionState, useEffect, useRef } from "react";
import { importChallengeDays } from "@/lib/actions/challenges";
import { initialChallengeImportState } from "@/lib/challenges/challengeImportState";

const LABEL = "block text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted";
const FIELD = "mt-1 w-full border border-rule-border bg-transparent px-3 py-2 text-sm";

const TEMPLATE = `day,content,prompt
1,Breathing reset,Start with five minutes of box breathing.
2,,Rest day — take a gentle walk and reflect.
3,Mobility flow,`;

/**
 * Bulk day-sequencer for one challenge -- paste CSV or upload a .csv to lay out a
 * whole programme's days at once, instead of one "Add a day" at a time. Sequences
 * content that already exists (referenced by title or id); load the content via
 * the content importer / Studio first. Lives in a collapsed <details> so the
 * authoring surface stays calm, and validates all-or-nothing with per-row errors.
 */
export function ChallengeDayImportForm({ challengeId }: { challengeId: string }) {
  const [state, formAction, isPending] = useActionState(importChallengeDays, initialChallengeImportState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <details className="border border-rule-border">
      <summary className="cursor-pointer list-none px-5 py-4 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted marker:content-none">
        Bulk import days from CSV
        <span className="ml-2 font-semibold normal-case tracking-normal text-muted">
          — sequence a whole programme at once
        </span>
      </summary>

      <form ref={formRef} action={formAction} className="space-y-5 border-t border-rule-border p-5">
        <input type="hidden" name="challengeId" value={challengeId} />

        <p className="text-sm text-muted">
          Paste CSV or choose a <code className="text-foreground">.csv</code> file. Every row is checked
          before anything is saved — if one row is wrong, nothing imports and you’ll see exactly which rows
          to fix. This sequences content that’s <b className="text-foreground">already loaded</b>; add new
          pieces in the Content Studio first.
        </p>

        <div>
          <label htmlFor="challenge-import-csv" className={LABEL}>
            CSV
          </label>
          <textarea
            id="challenge-import-csv"
            name="csv"
            rows={7}
            spellCheck={false}
            placeholder={TEMPLATE}
            className={`${FIELD} resize-y font-mono text-xs`}
          />
        </div>

        <div>
          <label htmlFor="challenge-import-file" className={LABEL}>
            …or upload a .csv
          </label>
          <input
            id="challenge-import-file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            className="mt-1 w-full text-xs file:mr-3 file:border file:border-rule-border file:bg-transparent file:px-3 file:py-1.5 file:text-xs file:font-semibold"
          />
          <p className="mt-1 text-xs text-muted">If a file is chosen, it’s used instead of the pasted text.</p>
        </div>

        <details className="border border-rule-hairline">
          <summary className="cursor-pointer px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
            Format &amp; columns
          </summary>
          <div className="space-y-2 border-t border-rule-hairline px-3 py-3 text-xs text-muted">
            <p>
              First row is the header. Required column: <b className="text-foreground">day</b> (a whole
              number 1–366). Optional: <b className="text-foreground">content</b> (an existing content
              item’s exact title, or its id) and <b className="text-foreground">prompt</b> (guidance for the
              day). Each day needs a <b className="text-foreground">content</b>, a{" "}
              <b className="text-foreground">prompt</b>, or both — a prompt-only row is a rest/reflection
              day.
            </p>
            <p>
              A <b className="text-foreground">content</b> value must match one existing item exactly; if two
              items share a title, reference the one you mean by its id. Each day number appears once, and a
              day that already exists in this challenge is reported rather than overwritten.
            </p>
            <pre className="overflow-x-auto whitespace-pre border border-rule-hairline bg-foreground/[0.02] p-2 text-[11px] leading-relaxed text-foreground">
              {TEMPLATE}
            </pre>
          </div>
        </details>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="bg-brand-accent px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
          >
            {isPending ? "Importing…" : "Import days"}
          </button>
          {state.status === "success" && (
            <p className="text-sm font-semibold text-foreground" role="status">
              {state.message}
            </p>
          )}
        </div>

        {state.status === "error" && (
          <div className="space-y-2" role="alert">
            <p className="text-sm text-brand-accent-deep">{state.message}</p>
            {state.rowErrors && state.rowErrors.length > 0 && (
              <ul className="max-h-56 overflow-y-auto border border-rule-hairline text-xs">
                {state.rowErrors.map((e, i) => (
                  <li
                    key={`${e.line}-${i}`}
                    className="flex gap-2 border-b border-rule-hairline px-3 py-1.5 last:border-b-0"
                  >
                    <span className="shrink-0 font-extrabold tabular-nums text-muted">Row {e.line}</span>
                    <span className="text-foreground">{e.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </form>
    </details>
  );
}
