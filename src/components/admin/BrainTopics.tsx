"use client";

import { useState, useTransition } from "react";
import {
  createTopicAction,
  renameTopicAction,
  deleteTopicAction,
  moveTopicAction,
  type TopicManageResult,
} from "@/lib/actions/brainTopicManage";
import type { ContentTopicWithCount } from "@/types/database";

/**
 * Manage the member Library's topic taxonomy — the editable "Browse by topic"
 * rooms. Add, rename, reorder and retire topics; the count is how many
 * published items each currently tags. Light admin-tool tokens (the dark shell
 * is only the sidebar/topbar chrome). ntitt_admin-gated on the actions + RLS.
 */
export function BrainTopics({ topics }: { topics: ContentTopicWithCount[] }) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [tone, setTone] = useState<"ok" | "error">("ok");
  const [newLabel, setNewLabel] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  function run(fn: () => Promise<TopicManageResult>, okMsg?: string) {
    setNote(null);
    startTransition(async () => {
      const res = await fn();
      if (res.status === "error") {
        setTone("error");
        setNote(res.message);
      } else {
        setTone("ok");
        if (okMsg) setNote(okMsg);
      }
    });
  }

  const draftFor = (t: ContentTopicWithCount) => drafts[t.id] ?? t.label;

  return (
    <div className="space-y-4 border-t border-rule-hairline p-4">
      <p className="text-xs text-muted">
        These are the rooms members browse by on the Library. New content is AI-tagged into them; edit the list here.
      </p>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const label = newLabel.trim();
          if (!label) return;
          run(() => createTopicAction({ label }));
          setNewLabel("");
        }}
      >
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Add a topic (e.g. Loneliness)"
          maxLength={40}
          className="min-w-0 flex-1 border border-rule-border bg-transparent px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending || !newLabel.trim()}
          className="bg-brand-accent px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {topics.length > 0 ? (
        <ul className="divide-y divide-rule-hairline border-y border-rule-hairline">
          {topics.map((t, i) => {
            const draft = draftFor(t);
            const changed = draft.trim().length > 0 && draft.trim() !== t.label;
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
                <div className="flex shrink-0 flex-col leading-none">
                  <button
                    type="button"
                    aria-label={`Move ${t.label} up`}
                    disabled={pending || i === 0}
                    onClick={() => run(() => moveTopicAction({ id: t.id, direction: "up" }))}
                    className="text-xs text-muted hover:text-foreground disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${t.label} down`}
                    disabled={pending || i === topics.length - 1}
                    onClick={() => run(() => moveTopicAction({ id: t.id, direction: "down" }))}
                    className="text-xs text-muted hover:text-foreground disabled:opacity-30"
                  >
                    ▼
                  </button>
                </div>
                <input
                  aria-label={`Rename ${t.label}`}
                  value={draft}
                  onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                  maxLength={40}
                  className="min-w-0 flex-1 border border-rule-border bg-transparent px-3 py-1.5 text-sm"
                />
                <span className="shrink-0 text-xs text-muted">
                  {t.count} {t.count === 1 ? "piece" : "pieces"}
                </span>
                {changed && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => renameTopicAction({ id: t.id, label: draft.trim() }), "Saved.")}
                    className="shrink-0 border border-foreground px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-50"
                  >
                    Save
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(`Remove “${t.label}”? Its content stays — only the topic tag is removed.`)) {
                      run(() => deleteTopicAction({ id: t.id }));
                    }
                  }}
                  className="shrink-0 text-[11px] font-extrabold uppercase tracking-wide text-brand-accent-deep hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">No topics yet — add the first one above.</p>
      )}

      {note && (
        <p
          className={`text-sm font-semibold ${tone === "error" ? "text-brand-accent-deep" : "text-foreground"}`}
          role="status"
        >
          {note}
        </p>
      )}
    </div>
  );
}
