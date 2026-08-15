"use client";

import { useState, useTransition } from "react";
import {
  proposeOrganizationAction,
  applyOrganizationAction,
  type OrganizationPlan,
} from "@/lib/actions/aiOrganize";

const NEW_SENTINEL = "__new__";

/**
 * The Brain's "auto-organise" control: ask the AI to propose a folder + tags for
 * the items currently in view, review the plan, adjust any proposed folder, tick
 * which to apply, and commit. Assistive-with-confirm — proposeOrganizationAction
 * writes nothing; only the admin's "Apply" (applyOrganizationAction) files and
 * retags. The per-row folder is editable: pick another existing folder, keep the
 * AI's suggestion, or type a brand-new name.
 */
export function BrainAutoOrganize({
  itemIds,
  folderNames,
  aiConfigured,
}: {
  itemIds: string[];
  /** Existing folder names, so a proposal can be redirected to one of them. */
  folderNames: string[];
  aiConfigured: boolean;
}) {
  const [plan, setPlan] = useState<OrganizationPlan | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  // Editable target folder per item (starts from the AI's proposal).
  const [folderByItem, setFolderByItem] = useState<Record<string, string>>({});
  // Rows switched to "type a new folder name" mode.
  const [customItems, setCustomItems] = useState<Set<string>>(new Set());
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
        setCustomItems(new Set());
        setFolderByItem(Object.fromEntries(result.plan.proposals.map((p) => [p.itemId, p.folder])));
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

  function setFolder(itemId: string, value: string) {
    setFolderByItem((prev) => ({ ...prev, [itemId]: value }));
  }

  function enterCustom(itemId: string) {
    setCustomItems((prev) => new Set(prev).add(itemId));
    setFolder(itemId, "");
  }

  function exitCustom(itemId: string, resetTo: string) {
    setCustomItems((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
    setFolder(itemId, resetTo);
  }

  function apply() {
    if (!plan) return;
    const included = plan.proposals.filter((p) => !excluded.has(p.itemId));
    const assignments = included.map((p) => ({
      itemId: p.itemId,
      folder: (folderByItem[p.itemId] ?? p.folder).trim(),
      tags: p.tags,
    }));
    if (assignments.length === 0) {
      setError("Tick at least one item to apply.");
      return;
    }
    if (assignments.some((a) => a.folder.length === 0)) {
      setError("Give every selected item a folder name.");
      return;
    }
    setError(null);
    startApply(async () => {
      const result = await applyOrganizationAction({ assignments });
      if (result.status === "success") {
        setPlan(null);
        setExcluded(new Set());
        setCustomItems(new Set());
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
          (and can tweak) before anything changes.
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

  // Folder options: existing folders first, then any new names the AI proposed,
  // deduped case-insensitively so an existing "Sleep" and a proposed "sleep"
  // collapse to one entry.
  const existingLower = new Set(folderNames.map((n) => n.toLowerCase()));
  const optionNames: string[] = [];
  const seenLower = new Set<string>();
  for (const name of [...folderNames, ...plan.proposals.map((p) => p.folder)]) {
    const lower = name.toLowerCase();
    if (!seenLower.has(lower)) {
      seenLower.add(lower);
      optionNames.push(name);
    }
  }

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
          const chosen = folderByItem[p.itemId] ?? p.folder;
          const inCustom = customItems.has(p.itemId);
          const isNew = chosen.trim().length > 0 && !existingLower.has(chosen.trim().toLowerCase());
          return (
            <li key={p.itemId} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={included}
                  onChange={() => toggle(p.itemId)}
                  aria-label={`Include ${p.title}`}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <div className={`min-w-0 flex-1 ${included ? "" : "opacity-40"}`}>
                  <span className="block truncate text-sm font-semibold">{p.title}</span>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">Folder</span>
                    {inCustom ? (
                      <>
                        <input
                          type="text"
                          value={chosen}
                          onChange={(e) => setFolder(p.itemId, e.target.value)}
                          placeholder="New folder name"
                          maxLength={80}
                          aria-label={`New folder name for ${p.title}`}
                          className="border border-rule-border bg-transparent px-2 py-0.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => exitCustom(p.itemId, p.folder)}
                          className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted hover:text-foreground"
                        >
                          Pick existing
                        </button>
                      </>
                    ) : (
                      <select
                        value={chosen}
                        onChange={(e) => {
                          if (e.target.value === NEW_SENTINEL) enterCustom(p.itemId);
                          else setFolder(p.itemId, e.target.value);
                        }}
                        aria-label={`Folder for ${p.title}`}
                        className="max-w-[12rem] truncate border border-rule-border bg-transparent px-2 py-0.5 text-xs font-semibold"
                      >
                        {optionNames.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                        <option value={NEW_SENTINEL}>＋ New folder…</option>
                      </select>
                    )}
                    {isNew && (
                      <span className="border border-brand-accent bg-brand-accent px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-foreground">
                        New
                      </span>
                    )}
                  </div>

                  {p.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">Tags</span>
                      {p.tags.map((tag) => (
                        <span key={tag} className="border border-rule-hairline px-1.5 py-0.5 text-[10px] text-muted">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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
