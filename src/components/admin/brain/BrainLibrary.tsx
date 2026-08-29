"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import type { ContentItem } from "@/types/database";
import {
  CATEGORY_LABEL,
  CONTENT_TYPES,
  DAY_SHORT,
  EMPTY_FILTER,
  TYPE_LABEL,
  VIDEO_CATEGORIES,
  filterBrainItems,
  isFilterActive,
  sortBrainItems,
  summarizeBrainItems,
  type BrainFilter,
  type BrainSort,
} from "@/lib/admin/brainLibrary";
import {
  bulkAddTagAction,
  bulkDeleteAction,
  bulkMoveToFolderAction,
  bulkSetDayAction,
  bulkSetPublishedAction,
  type BulkResult,
} from "@/lib/actions/brainBulk";

type Folder = { id: string; name: string };

/**
 * The Brain library console: an at-a-glance stats strip, a command bar
 * (search · type · status · category · day · sort), a tightened selectable card
 * grid, and a sticky multi-select action bar (file · publish · tag · day ·
 * delete). All filtering/sorting is client-side over the items the server page
 * hands in for the current folder view; bulk mutations go through the
 * ntitt_admin-gated actions in lib/actions/brainBulk and revalidate the page.
 */
export function BrainLibrary({
  items,
  folders,
  assetUrls,
}: {
  items: ContentItem[];
  folders: Folder[];
  assetUrls: Record<string, string>;
}) {
  const [filter, setFilter] = useState<BrainFilter>(EMPTY_FILTER);
  const [sort, setSort] = useState<BrainSort>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tagDraft, setTagDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const stats = useMemo(() => summarizeBrainItems(items), [items]);
  const filtered = useMemo(
    () => sortBrainItems(filterBrainItems(items, filter), sort),
    [items, filter, sort]
  );

  const filteredIds = filtered.map((i) => i.id);
  const allShown = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllShown() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allShown) filteredIds.forEach((id) => next.delete(id));
      else filteredIds.forEach((id) => next.add(id));
      return next;
    });
  }
  const clear = () => setSelected(new Set());

  function runBulk(fn: () => Promise<BulkResult>, verb: (n: number) => string) {
    setNote(null);
    startTransition(async () => {
      const res = await fn();
      if (res.status === "error") setNote(res.message);
      else {
        setNote(verb(res.count));
        setSelected(new Set());
        setTagDraft("");
      }
    });
  }

  const ids = () => [...selected];
  const setType = (t: ContentItem["type"]) =>
    setFilter((f) => ({
      ...f,
      types: f.types.includes(t) ? f.types.filter((x) => x !== t) : [...f.types, t],
    }));

  return (
    <div className="mt-6">
      {/* ---- Stats strip ---- */}
      <div className="flex flex-wrap gap-2">
        <Stat label="Total" value={stats.total} />
        <Stat label="Live" value={stats.live} />
        <Stat label="Draft" value={stats.draft} accent={stats.draft > 0} />
        <Stat label="Unfiled" value={stats.unfiled} accent={stats.unfiled > 0} />
        <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 self-center text-[11px] text-muted">
          {CONTENT_TYPES.filter((t) => stats.byType[t] > 0).map((t) => (
            <span key={t}>
              {stats.byType[t]} {TYPE_LABEL[t].toLowerCase()}
              {stats.byType[t] === 1 ? "" : "s"}
            </span>
          ))}
        </span>
      </div>

      {/* ---- Command bar ---- */}
      <div className="mt-4 space-y-3 border border-rule-border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={filter.search}
            onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
            placeholder="Search title, summary or tags…"
            className="min-w-[12rem] flex-1 border border-rule-border bg-transparent px-3 py-1.5 text-sm"
            aria-label="Search the Brain"
          />
          <label className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as BrainSort)}
              className="border border-rule-border bg-transparent px-2 py-1.5 text-xs text-foreground"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="title">Title A–Z</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Type */}
          <div className="flex flex-wrap items-center gap-1">
            {CONTENT_TYPES.map((t) => (
              <Chip key={t} active={filter.types.includes(t)} onClick={() => setType(t)}>
                {TYPE_LABEL[t]}
              </Chip>
            ))}
          </div>
          {/* Status */}
          <Segmented
            value={filter.status}
            onChange={(v) => setFilter((f) => ({ ...f, status: v }))}
            options={[
              { value: "all", label: "All" },
              { value: "live", label: "Live" },
              { value: "draft", label: "Draft" },
            ]}
          />
          {/* Category */}
          <select
            value={filter.categories[0] ?? ""}
            onChange={(e) =>
              setFilter((f) => ({
                ...f,
                categories: e.target.value ? [e.target.value as (typeof VIDEO_CATEGORIES)[number]] : [],
              }))
            }
            className="border border-rule-border bg-transparent px-2 py-1.5 text-xs text-foreground"
            aria-label="Filter by theme"
          >
            <option value="">All themes</option>
            {VIDEO_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          {/* Day */}
          <select
            value={filter.day === "all" ? "all" : filter.day === "agnostic" ? "agnostic" : String(filter.day)}
            onChange={(e) => {
              const v = e.target.value;
              setFilter((f) => ({ ...f, day: v === "all" || v === "agnostic" ? v : Number(v) }));
            }}
            className="border border-rule-border bg-transparent px-2 py-1.5 text-xs text-foreground"
            aria-label="Filter by day"
          >
            <option value="all">Any day</option>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <option key={d} value={d}>
                {DAY_SHORT[d]}
              </option>
            ))}
            <option value="agnostic">Day-agnostic</option>
          </select>
          {isFilterActive(filter) && (
            <button
              type="button"
              onClick={() => setFilter(EMPTY_FILTER)}
              className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand-accent-deep hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ---- Result count + select-all ---- */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>
          Showing <b className="text-foreground">{filtered.length}</b>
          {filtered.length !== items.length ? ` of ${items.length}` : ""}
        </span>
        {filtered.length > 0 && (
          <button type="button" onClick={toggleAllShown} className="font-semibold text-foreground hover:underline">
            {allShown ? "Deselect all" : "Select all shown"}
          </button>
        )}
      </div>

      {/* ---- Grid ---- */}
      {filtered.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          {items.length === 0
            ? "Nothing here yet — add or import content above."
            : "No items match these filters."}
        </p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((item) => (
            <BrainCard
              key={item.id}
              item={item}
              assetUrl={assetUrls[item.id]}
              folderName={folders.find((f) => f.id === item.folder_id)?.name}
              selected={selected.has(item.id)}
              onToggle={() => toggle(item.id)}
            />
          ))}
        </ul>
      )}

      {/* spacer so the sticky bar never hides the last row (only when sticky, i.e. sm+) */}
      {selected.size > 0 && <div className="hidden h-24 sm:block" />}

      {/* ---- Bulk action bar. In-flow on mobile (the ~10 wrapping controls would
           otherwise stack tall as a sticky overlay and cover the small viewport);
           sticky above the fold from sm up. ---- */}
      {selected.size > 0 && (
        <div className="mt-4 sm:sticky sm:bottom-4 sm:z-10">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-2 border-foreground bg-background p-3 shadow-[4px_4px_0_0_var(--color-foreground)]">
            <span className="text-sm font-extrabold">{selected.size} selected</span>
            <button type="button" onClick={clear} className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted hover:text-foreground">
              Clear
            </button>

            <span className="mx-1 h-5 w-px bg-rule-border" />

            {/* File into folder */}
            <label className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted">
              File into
              <select
                value=""
                disabled={pending}
                onChange={(e) =>
                  runBulk(
                    () => bulkMoveToFolderAction({ ids: ids(), folderId: e.target.value || null }),
                    (n) => `Filed ${n} item${n === 1 ? "" : "s"}.`
                  )
                }
                className="border border-rule-border bg-transparent px-2 py-1 text-xs text-foreground disabled:opacity-50"
              >
                <option value="" disabled>
                  Choose…
                </option>
                <option value="">Unfiled</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>

            <BarButton disabled={pending} onClick={() => runBulk(() => bulkSetPublishedAction({ ids: ids(), published: true }), (n) => `Published ${n}.`)}>
              Publish
            </BarButton>
            <BarButton disabled={pending} onClick={() => runBulk(() => bulkSetPublishedAction({ ids: ids(), published: false }), (n) => `Unpublished ${n}.`)}>
              Unpublish
            </BarButton>

            {/* Set day */}
            <label className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted">
              Day
              <select
                value=""
                disabled={pending}
                onChange={(e) =>
                  runBulk(
                    () => bulkSetDayAction({ ids: ids(), day: e.target.value === "none" ? null : Number(e.target.value) }),
                    (n) => `Updated ${n}.`
                  )
                }
                className="border border-rule-border bg-transparent px-2 py-1 text-xs text-foreground disabled:opacity-50"
              >
                <option value="" disabled>
                  Set…
                </option>
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <option key={d} value={d}>
                    {DAY_SHORT[d]}
                  </option>
                ))}
                <option value="none">Day-agnostic</option>
              </select>
            </label>

            {/* Add tag */}
            <span className="flex items-center gap-1">
              <input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagDraft.trim() && !pending) {
                    e.preventDefault();
                    runBulk(() => bulkAddTagAction({ ids: ids(), tag: tagDraft }), (n) => `Tagged ${n}.`);
                  }
                }}
                placeholder="add tag…"
                className="w-24 border border-rule-border bg-transparent px-2 py-1 text-xs"
                aria-label="Tag to add to selected"
              />
              <BarButton
                disabled={pending || tagDraft.trim() === ""}
                onClick={() => runBulk(() => bulkAddTagAction({ ids: ids(), tag: tagDraft }), (n) => `Tagged ${n}.`)}
              >
                Add
              </BarButton>
            </span>

            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Delete ${selected.size} item${selected.size === 1 ? "" : "s"}? This can’t be undone.`)) {
                  runBulk(() => bulkDeleteAction({ ids: ids() }), (n) => `Deleted ${n}.`);
                }
              }}
              className="ml-auto border border-brand-accent px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand-accent-deep hover:bg-brand-accent hover:text-brand-accent-foreground disabled:opacity-50"
            >
              Delete
            </button>

            {note && (
              <span className="w-full text-xs font-semibold text-foreground" role="status">
                {note}
              </span>
            )}
          </div>
        </div>
      )}

      {/* result note when nothing is selected (e.g. after a bulk op cleared the selection) */}
      {selected.size === 0 && note && (
        <p className="mt-4 text-xs font-semibold text-foreground" role="status">
          {note}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`border px-3 py-2 ${accent ? "border-brand-accent" : "border-rule-border"}`}>
      <div className="text-lg font-extrabold leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">{label}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.1em] transition-colors ${
        active
          ? "border-brand-accent bg-brand-accent text-brand-accent-foreground"
          : "border-rule-border text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex border border-rule-border">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.1em] transition-colors ${
            value === o.value ? "bg-foreground text-background" : "text-muted hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function BarButton({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="border border-rule-border px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-foreground hover:border-brand-accent disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function BrainCard({
  item,
  assetUrl,
  folderName,
  selected,
  onToggle,
}: {
  item: ContentItem;
  assetUrl?: string;
  folderName?: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const imageSrc =
    item.type === "image"
      ? assetUrl ?? item.external_url ?? null
      : item.type === "video"
        ? item.thumbnail_url ?? null
        : null;

  return (
    <li
      className={`flex flex-col border transition-colors ${
        selected ? "border-brand-accent bg-brand-accent/[0.04]" : "border-rule-border"
      }`}
    >
      {/* Poster doubles as the select target (label wraps the checkbox). Text
          items carry no media, so they get a slim selectable header strip. */}
      <label className="relative block cursor-pointer">
        <span className="absolute left-2 top-2 z-10">
          <input type="checkbox" checked={selected} onChange={onToggle} className="h-4 w-4" aria-label={`Select ${item.title}`} />
        </span>
        <span
          className={
            "absolute right-2 top-2 z-10 border px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] " +
            (item.is_published
              ? "border-rule-border bg-background text-muted"
              : "border-brand-accent bg-brand-accent text-brand-accent-foreground")
          }
        >
          {item.is_published ? "Live" : "Draft"}
        </span>
        {item.type === "text" ? (
          <div className="h-9 border-b border-rule-hairline bg-foreground/[0.03]" />
        ) : imageSrc ? (
          <div className="relative aspect-video w-full border-b border-rule-hairline">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote/derived URL, not a local/optimizable asset */}
            <img src={imageSrc} alt="" className="h-full w-full object-cover" />
            {item.type === "video" && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/70 text-xs text-background">
                  ▶
                </span>
              </span>
            )}
          </div>
        ) : (
          <div className="flex aspect-video w-full items-center justify-center border-b border-rule-hairline bg-foreground/[0.03]">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-muted">
              {item.type === "video" ? "▶" : "PDF"}
            </span>
          </div>
        )}
      </label>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2.5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
          {TYPE_LABEL[item.type]} · {CATEGORY_LABEL[item.category]}
          {item.day_of_week ? ` · ${DAY_SHORT[item.day_of_week]}` : ""}
        </p>
        <p className="line-clamp-2 text-sm font-extrabold leading-tight tracking-tight">{item.title}</p>
        {item.type === "text" && item.summary && (
          <p className="line-clamp-3 text-xs text-muted">{item.summary}</p>
        )}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="border border-rule-hairline px-1.5 py-0.5 text-[10px] text-muted">
                {tag}
              </span>
            ))}
            {item.tags.length > 3 && <span className="px-1 py-0.5 text-[10px] text-muted">+{item.tags.length - 3}</span>}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-rule-hairline pt-2">
          <span className="min-w-0 truncate text-[10px] uppercase tracking-[0.12em] text-muted">
            {folderName ?? "Unfiled"}
          </span>
          <Link
            href={`/admin/content/${item.id}/edit`}
            className="shrink-0 border border-rule-border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted hover:text-foreground"
          >
            Edit
          </Link>
        </div>
      </div>
    </li>
  );
}
