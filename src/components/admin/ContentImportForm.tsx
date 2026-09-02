"use client";

import { useActionState, useEffect, useRef } from "react";
import { importContentItems } from "@/lib/actions/content";
import { initialContentImportState } from "@/lib/content/importState";

const LABEL = "block text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted";
const FIELD = "mt-1 w-full border border-rule-border bg-transparent px-3 py-2 text-sm";

const TEMPLATE = `type,title,category,day,folder,vimeo_id,external_url,tags,summary,publish
video,Breathing reset,mental_fitness,monday,,123456789,,"stress;sleep",A 5-minute box-breathing reset,true
text,Win the next point,mental_fitness,monday,Momentum Monday,,,focus;goals,Don't try to win the match — just win the next point,false
document,Nutrition basics,nutrition,,,,https://example.com/guide.pdf,nutrition,One-page starter guide,false`;

/**
 * Bulk content importer -- paste CSV or upload a .csv, validate every row
 * through the same schema as the single-add form, and insert all-or-nothing.
 * Lives in a collapsed <details> under the composer so the Studio stays calm;
 * an operator loading a launch catalogue opens it, an operator adding one piece
 * never sees it. The rich result (per-row errors, a live/draft summary) needs
 * more than the single-string RoutineActionState, so this action has its own
 * ContentImportState.
 */
export function ContentImportForm() {
  const [state, formAction, isPending] = useActionState(importContentItems, initialContentImportState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // Clear the (uncontrolled) textarea + file input on a clean import so a
    // second batch starts empty and the same file isn't re-imported by accident.
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <details className="border border-rule-border">
      <summary className="cursor-pointer list-none px-5 py-4 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted marker:content-none">
        Bulk import from CSV
        <span className="ml-2 font-semibold normal-case tracking-normal text-muted">
          — load a whole catalogue at once
        </span>
      </summary>

      <form ref={formRef} action={formAction} className="space-y-5 border-t border-rule-border p-5">
        <p className="text-sm text-muted">
          Paste CSV or choose a <code className="text-foreground">.csv</code> file. Every row is checked
          before anything is saved — if one row is wrong, nothing imports and you’ll see exactly which
          rows to fix. Imported items are NTITT-wide (everyone); to target a partner channel, add that
          piece in the form above.
        </p>

        <div>
          <label htmlFor="import-csv" className={LABEL}>
            CSV
          </label>
          <textarea
            id="import-csv"
            name="csv"
            rows={7}
            spellCheck={false}
            placeholder={TEMPLATE}
            className={`${FIELD} resize-y font-mono text-xs`}
          />
        </div>

        <div>
          <label htmlFor="import-file" className={LABEL}>
            …or upload a .csv
          </label>
          <input
            id="import-file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            className="mt-1 w-full text-xs file:mr-3 file:border file:border-rule-border file:bg-transparent file:px-3 file:py-1.5 file:text-xs file:font-semibold"
          />
          <p className="mt-1 text-xs text-muted">If a file is chosen, it’s used instead of the pasted text.</p>
        </div>

        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="defaultPublish" value="true" defaultChecked className="h-4 w-4" />
          Publish imported items now (rows with their own <code className="font-mono text-xs">publish</code> value win)
        </label>

        <details className="border border-rule-hairline">
          <summary className="cursor-pointer px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
            Format &amp; columns
          </summary>
          <div className="space-y-2 border-t border-rule-hairline px-3 py-3 text-xs text-muted">
            <p>
              First row is the header. Required columns: <b className="text-foreground">title</b> and{" "}
              <b className="text-foreground">category</b>. Optional: <b className="text-foreground">type</b>{" "}
              (video/document/image/text, default video), <b className="text-foreground">day</b> (1–7 or a
              weekday name, blank = any day), <b className="text-foreground">folder</b> (the Brain folder to
              file it under — created if new, blank = Unfiled), <b className="text-foreground">vimeo_id</b>,{" "}
              <b className="text-foreground">external_url</b>, <b className="text-foreground">tags</b>,{" "}
              <b className="text-foreground">summary</b>, <b className="text-foreground">publish</b>.
            </p>
            <p>
              A video row needs a numeric <b className="text-foreground">vimeo_id</b>; a document/image row
              needs an <b className="text-foreground">external_url</b> (file uploads use the form above); a{" "}
              <b className="text-foreground">text</b> row needs neither — just a title and summary. Category is
              one of <code>mental_fitness</code>, <code>physical_fitness</code>, <code>nutrition</code>,{" "}
              <code>tools_tips</code>. Separate tags with <code>;</code> (or wrap a comma-containing cell in
              double quotes).
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
            {isPending ? "Importing…" : "Import content"}
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
