"use client";

import { useCallback, useState, useTransition } from "react";
import {
  importVimeoVideosAction,
  listVimeoLibraryAction,
  type VimeoListItem,
} from "@/lib/actions/vimeoImport";
import type { VideoCategory } from "@/types/database";

const CATEGORIES: { value: VideoCategory; label: string }[] = [
  { value: "mental_fitness", label: "Mental Fitness" },
  { value: "physical_fitness", label: "Physical Fitness" },
  { value: "nutrition", label: "Nutrition" },
  { value: "tools_tips", label: "Tools & Tips" },
];

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * The grid of Vimeo videos, presentational so it can be rendered in isolation.
 * A video already in the Brain is shown dimmed + non-selectable; a privacy
 * warning is surfaced so the operator can fix it in Vimeo before it fails to
 * play.
 */
export function VimeoImportGrid({
  videos,
  selected,
  onToggle,
}: {
  videos: VimeoListItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {videos.map((v) => {
        const isSelected = selected.has(v.id);
        const duration = formatDuration(v.durationSeconds);
        return (
          <li key={v.id}>
            <label
              className={`flex h-full cursor-pointer flex-col border transition-colors ${
                v.alreadyImported
                  ? "cursor-default border-rule-border opacity-60"
                  : isSelected
                    ? "border-brand-accent bg-brand-accent/[0.04]"
                    : "border-rule-border hover:border-brand-accent"
              }`}
            >
              <div className="relative aspect-video w-full border-b border-rule-hairline">
                {v.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote Vimeo poster, not a local/optimizable asset
                  <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-foreground/[0.03] text-[11px] font-extrabold uppercase tracking-[0.2em] text-muted">
                    ▶
                  </div>
                )}
                <span className="absolute left-2 top-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={isSelected}
                    disabled={v.alreadyImported}
                    onChange={() => onToggle(v.id)}
                  />
                </span>
                {v.alreadyImported && (
                  <span className="absolute right-2 top-2 bg-foreground px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-background">
                    In Brain
                  </span>
                )}
                {duration && (
                  <span className="absolute bottom-2 right-2 bg-foreground/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-background">
                    {duration}
                  </span>
                )}
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-1 p-2">
                <p className="line-clamp-2 text-sm font-semibold leading-tight">{v.name || "Untitled video"}</p>
                {v.warning && <p className="mt-auto text-[11px] leading-snug text-brand-accent-deep">⚠ {v.warning}</p>}
              </div>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * "Import from Vimeo" — the Brain picker. Lists the connected Vimeo account,
 * lets the operator tick the videos that belong on the platform, and imports the
 * selection as DRAFT content_items (title/description/duration/thumbnail/hash
 * auto-filled) into the open folder. Loads lazily (a button, not on every Brain
 * page load). Degrades to a "connect Vimeo" note when no token is set.
 */
export function BrainVimeoImport({ folderId, folderName }: { folderId?: string; folderName?: string }) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "not_configured" }
    | { kind: "error"; message: string }
    | { kind: "ready"; videos: VimeoListItem[]; page: number; hasNext: boolean }
  >({ kind: "idle" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<VideoCategory>("mental_fitness");
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [importing, startImport] = useTransition();

  const load = useCallback((page: number, q: string, append: boolean) => {
    setNote(null);
    startLoad(async () => {
      const res = await listVimeoLibraryAction({ page, query: q || undefined });
      if (res.status === "not_configured") return setState({ kind: "not_configured" });
      if (res.status === "error") return setState({ kind: "error", message: res.message });
      setState((prev) =>
        append && prev.kind === "ready"
          ? { kind: "ready", videos: [...prev.videos, ...res.videos], page: res.page, hasNext: res.hasNext }
          : { kind: "ready", videos: res.videos, page: res.page, hasNext: res.hasNext }
      );
    });
  }, []);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function runImport() {
    if (state.kind !== "ready" || selected.size === 0) return;
    const chosen = state.videos
      .filter((v) => selected.has(v.id) && !v.alreadyImported)
      .map((v) => ({
        id: v.id,
        name: v.name,
        description: v.description,
        durationSeconds: v.durationSeconds,
        thumbnailUrl: v.thumbnailUrl,
        hash: v.hash,
      }));
    if (chosen.length === 0) return;
    setNote(null);
    startImport(async () => {
      const res = await importVimeoVideosAction({ videos: chosen, category, folderId: folderId ?? null });
      if (res.status === "error") {
        setNote(res.message);
        return;
      }
      const importedIds = new Set(chosen.map((c) => c.id));
      setState((prev) =>
        prev.kind === "ready"
          ? { ...prev, videos: prev.videos.map((v) => (importedIds.has(v.id) ? { ...v, alreadyImported: true } : v)) }
          : prev
      );
      setSelected(new Set());
      setNote(
        `Imported ${res.imported} as draft${res.imported === 1 ? "" : "s"}${
          res.skipped > 0 ? ` · ${res.skipped} already in the Brain` : ""
        }.`
      );
    });
  }

  return (
    <details className="border border-rule-border">
      <summary className="cursor-pointer list-none px-5 py-4 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted marker:content-none">
        Import from Vimeo
        <span className="ml-2 font-semibold normal-case tracking-normal text-muted">
          — pull videos straight from your account
        </span>
      </summary>

      <div className="space-y-4 border-t border-rule-border p-5">
        {state.kind === "not_configured" ? (
          <div className="text-sm text-muted">
            <p className="font-semibold text-foreground">Vimeo isn’t connected yet.</p>
            <p className="mt-1">
              Add a Vimeo access token (<code className="text-foreground">vimeo_access_token</code>) in the
              deployment’s environment — a Personal Access Token from{" "}
              <span className="text-foreground">developer.vimeo.com</span> with read scopes. Then reload this page.
              Pasting a Vimeo ID in Content Studio keeps working in the meantime.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted">
              Pick the videos that belong on the platform. Each imports as a <b className="text-foreground">draft</b>{" "}
              with its title, description, duration and thumbnail filled in
              {folderName ? (
                <>
                  , filed into <b className="text-foreground">“{folderName}”</b>
                </>
              ) : null}
              . Publish and tag them afterwards with the tools below.
            </p>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[12rem]">
                <label htmlFor="vimeo-search" className="block text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
                  Search
                </label>
                <input
                  id="vimeo-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      load(1, query, false);
                    }
                  }}
                  placeholder="Filter by title…"
                  className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="vimeo-category" className="block text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
                  Theme for imports
                </label>
                <select
                  id="vimeo-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as VideoCategory)}
                  className="mt-1 border border-rule-border bg-transparent px-3 py-2 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => load(1, query, false)}
                disabled={loading}
                className="border border-rule-border px-4 py-2 text-sm font-semibold transition-colors hover:border-brand-accent disabled:opacity-50"
              >
                {loading && state.kind !== "ready" ? "Loading…" : state.kind === "ready" ? "Refresh" : "Load my Vimeo library"}
              </button>
            </div>

            {state.kind === "error" && <p className="text-sm text-brand-accent-deep">{state.message}</p>}

            {state.kind === "ready" && (
              <>
                {state.videos.length === 0 ? (
                  <p className="text-sm text-muted">No videos found{query ? " for that search" : ""}.</p>
                ) : (
                  <>
                    <VimeoImportGrid videos={state.videos} selected={selected} onToggle={toggle} />
                    {state.hasNext && (
                      <button
                        type="button"
                        onClick={() => load(state.page + 1, query, true)}
                        disabled={loading}
                        className="mt-3 border border-rule-border px-4 py-2 text-sm font-semibold transition-colors hover:border-brand-accent disabled:opacity-50"
                      >
                        {loading ? "Loading…" : "Load more"}
                      </button>
                    )}
                  </>
                )}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-rule-hairline pt-4">
                  <button
                    type="button"
                    onClick={runImport}
                    disabled={importing || selected.size === 0}
                    className="bg-brand-accent px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground transition-colors hover:bg-brand-accent-deep disabled:opacity-50"
                  >
                    {importing ? "Importing…" : `Import ${selected.size} selected`}
                  </button>
                  <span className="text-xs text-muted">Imports as drafts — nothing goes live until you publish.</span>
                </div>
              </>
            )}

            {note && (
              <p className="text-sm font-semibold text-foreground" role="status">
                {note}
              </p>
            )}
          </>
        )}
      </div>
    </details>
  );
}
