"use client";

import { useState, useTransition } from "react";
import {
  proposeOrganizationAction,
  applyOrganizationAction,
  type OrganizationPlan,
} from "@/lib/actions/aiOrganize";

/**
 * The Brain's "auto-organise" control: ask the AI to propose a folder + tags for
 * the items currently in view, review the plan, tick which to apply, and commit.
 * Assistive-with-confirm — proposeOrganizationAction writes nothing; only the
 * admin's "Apply" (applyOrganizationAction) files and retags. Mirrors the
 * ContentStudioForm "Suggest" pattern (useTransition around a returning action),
 * scaled to a batch.
 */
export function BrainAutoOrganize({
  itemIds,
  aiConfigured,
}: {
  itemIds: string[];
  aiConfigured: boolean;
}) {
  const [plan, setPlan] = useState<OrganizationPlan | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [proposePending, startPropose] = useTransition();
  const [applyPending, startApply] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (!aiConfigured) {
    return <p className="text-xs text-muted">AI organising isn’t configured in this environment.</p>;
  }

  function propose() {
    setError(null);
    setNote(null);
    startPropose(async () => {
      const result = await proposeOrganizationAction({ itemIds });
      if (result.status === "ok") {
        setPlan(result.plan);
        setExcluded(new Set());
      } else {
        setError(result.message);
      }
    });
  }

  function toggle(itemId: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function apply() {
    if (!plan) return;
    const assignments = plan.proposals
      .filter((p) => !excluded.has(p.itemId))
      .map((p) => ({ itemId: p.itemId, folder: p.folder, tags: p.tags }));
    if (assignments.length === 0) {
      setError("Tick at least one item to apply.");
      return;
    }
    setError(null);
    startApply(async () => {
      const result = await applyOrganizationAction({ assignments });
      if (result.status === "success") {
        setPlan(null);
        setExcluded(new Set());
        setNote(`Organised ${assignments.length} item${assignments.length === 1 ? "" : "s"}.`);
      } else {
        setError(result.status === "error" ? result.message : "Couldn’t apply the changes. Please try again.");
      }
    });
  }

  if (!plan) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={propose}
          disabled={proposePending || itemIds.length === 0}
          className="border border-brand-accent px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep transition-colors hover:bg-brand-accent hover:text-brand-accent-foreground disabled:opacity-40"
        >
          {proposePending ? "Thinking…" : "✦ Auto-organise with AI"}
        </button>
        <span className="text-xs text-muted">
          Proposes a folder &amp; tags for the {itemIds.length} item{itemIds.length === 1 ? "" : "s"} in view — you approve
          before anything changes.
        </span>
        {note && (
          <span className="text-xs font-semibold text-foreground" role="status">
            {note}
          </span>
        )}
        {error && (
          <span className="text-xs text-brand-accent-deep" role="status">
            {error}
          </span>
        )}
      </div>
    );
  }

  const selectedCount = plan.proposals.length - excluded.size;

  return (
    <div className="border border-brand-accent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule-hairline bg-foreground/[0.03] px-4 py-2.5">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep">
          Proposed organisation · {plan.proposals.length} item{plan.proposals.length === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={apply}
            disabled={applyPending || selectedCount === 0}
            className="bg-brand-accent px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-foreground disabled:opacity-50"
          >
            {applyPending ? "Applying…" : `Apply ${selectedCount} selected`}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlan(null);
              setError(null);
            }}
            disabled={applyPending}
            className="px-2 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted hover:text-foreground disabled:opacity-50"
          >
            Discard
          </button>
        </div>
      </div>

      {plan.truncated > 0 && (
        <p className="border-b border-rule-hairline px-4 py-2 text-xs text-muted">
          Organising the first {plan.proposals.length} — {plan.truncated} more not shown. Apply these, then run it again
          for the rest.
        </p>
      )}

      <ul className="divide-y divide-rule-hairline">
        {plan.proposals.map((p) => {
          const included = !excluded.has(p.itemId);
          return (
            <li key={p.itemId}>
              <label className="flex cursor-pointer items-start gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={included}
                  onChange={() => toggle(p.itemId)}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span className={`min-w-0 flex-1 ${included ? "" : "opacity-40"}`}>
                  <span className="block truncate text-sm font-semibold">{p.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">→</span>
                    <span className="border border-rule-border px-1.5 py-0.5 text-[11px] font-semibold">
                      {p.folder}
                    </span>
                    {p.isNewFolder && (
                      <span className="border border-brand-accent bg-brand-accent px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-foreground">
                        New
                      </span>
                    )}
                    {p.tags.map((tag) => (
                      <span key={tag} className="border border-rule-hairline px-1.5 py-0.5 text-[10px] text-muted">
                        {tag}
                      </span>
                    ))}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="border-t border-rule-hairline px-4 py-2 text-xs text-brand-accent-deep" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
