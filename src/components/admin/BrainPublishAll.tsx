"use client";

import { useState, useTransition } from "react";
import { bulkPublishContentItems } from "@/lib/actions/content";

/**
 * The Brain's "publish all drafts in this view" control. Flips every draft item
 * currently shown (All items, or the open folder) to live in one click -- the
 * companion to bulk CSV import, so a freshly-loaded batch (e.g. the journal)
 * becomes usable without publishing card-by-card. Publish-only; renders nothing
 * when there's no draft to publish. The action revalidates /admin/brain, so the
 * grid re-renders with the items flipped to Live.
 */
export function BrainPublishAll({ draftIds }: { draftIds: string[] }) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (draftIds.length === 0) return null;

  const label = `${draftIds.length} draft${draftIds.length === 1 ? "" : "s"}`;

  function publishAll() {
    setNote(null);
    setError(null);
    if (!window.confirm(`Publish ${label}? They become visible to members. You can unpublish any of them later.`)) {
      return;
    }
    startTransition(async () => {
      const result = await bulkPublishContentItems(draftIds);
      if (result.status === "success") {
        setNote(`Published ${result.published} item${result.published === 1 ? "" : "s"}.`);
      } else {
        setError(result.message ?? "Couldn’t publish those. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={publishAll}
        disabled={pending}
        className="bg-brand-accent px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-foreground transition-colors hover:bg-brand-accent-deep disabled:opacity-50"
      >
        {pending ? "Publishing…" : `Publish all ${label}`}
      </button>
      <span className="text-xs text-muted">Makes every draft in this view live to members.</span>
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
