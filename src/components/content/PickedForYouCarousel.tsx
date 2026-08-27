"use client";

import { useState } from "react";
import Link from "next/link";
import type { ContentItem, VideoCategory } from "@/types/database";

/**
 * The Library's "Picked for you" hero carousel (the designers' mockup — the
 * "Four minutes that change the afternoon" row). One curated bank of videos,
 * shown in three member-switchable layouts via the CAROUSEL control:
 *
 *   • STACK  — a centre-focused coverflow; a symmetric window of cards around
 *              the focus, the middle one enlarged + red-bordered with an info
 *              block, ‹ › arrows step the focus.
 *   • ANCHOR — a large red-bordered lead card + a scrolling strip of the rest
 *              (the same shape as the Library's editorial shelves).
 *   • STRIP  — a plain horizontal scroll of equal cards.
 *
 * Client component (it owns the mode + focus state); the page passes the
 * already-fetched items. On the Library's data-surface="ink" scope every token
 * resolves to the ink palette. Renders nothing when there's nothing to show.
 */

type Mode = "stack" | "anchor" | "strip";

const MODES: { key: Mode; label: string }[] = [
  { key: "stack", label: "Stack" },
  { key: "anchor", label: "Anchor" },
  { key: "strip", label: "Strip" },
];

const CATEGORY_LABEL: Record<VideoCategory, string> = {
  mental_fitness: "Mental Fitness",
  physical_fitness: "Physical Fitness",
  nutrition: "Nutrition",
  tools_tips: "Tools & Tips",
};

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  return `${Math.round(seconds / 60)} min`;
}

/** A short topic-ish label above a card: the first tag, else the category. */
function eyebrowFor(item: ContentItem): string {
  if (item.tags.length > 0) return item.tags[0];
  if (item.category && CATEGORY_LABEL[item.category as VideoCategory]) return CATEGORY_LABEL[item.category as VideoCategory];
  return "Watch";
}

export function PickedForYouCarousel({ items }: { items: ContentItem[] }) {
  const [mode, setMode] = useState<Mode>("stack");
  // Start focused on the middle card, like the mockup.
  const [focus, setFocus] = useState(() => Math.floor(items.length / 2));

  if (items.length === 0) return null;

  return (
    <section aria-label="Picked for you">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-light-2">
            Start here · Picked for you
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-4xl">
            Four minutes that change the afternoon
          </h2>
        </div>

        {/* CAROUSEL layout toggle. */}
        <div className="flex shrink-0 items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide">
          <span className="text-muted">Carousel</span>
          <div className="flex border border-rule-border" role="group" aria-label="Carousel layout">
            {MODES.map((m) => {
              const active = mode === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMode(m.key)}
                  className={`px-3 py-1.5 transition-colors ${
                    active ? "bg-brand-accent text-brand-accent-foreground" : "text-muted hover:text-foreground"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 border-t border-brand-accent" />

      <div className="mt-6">
        {mode === "stack" ? (
          <StackCarousel items={items} focus={focus} setFocus={setFocus} />
        ) : mode === "anchor" ? (
          <AnchorCarousel items={items} />
        ) : (
          <StripCarousel items={items} />
        )}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------- */

// A symmetric window of card positions around the focus. Rendering all five
// slots (with invisible spacers past the ends) keeps the focused card dead
// centre at every position, including the first and last — no scroll maths.
const WINDOW = [-2, -1, 0, 1, 2];

function StackCarousel({
  items,
  focus,
  setFocus,
}: {
  items: ContentItem[];
  focus: number;
  setFocus: (n: number) => void;
}) {
  const safeFocus = Math.min(Math.max(focus, 0), items.length - 1);

  return (
    <div className="relative overflow-hidden px-12">
      <div className="flex items-start justify-center gap-4">
        {WINDOW.map((offset) => {
          const idx = safeFocus + offset;
          const abs = Math.abs(offset);
          const width = offset === 0 ? "w-72 sm:w-80" : abs === 1 ? "w-56" : "w-40";
          // The far peek cards are hidden on narrow screens (focus ±1 there).
          const hideOnMobile = abs === 2 ? "hidden sm:block" : "";

          if (idx < 0 || idx >= items.length) {
            return <div key={offset} className={`${hideOnMobile} ${width} shrink-0`} aria-hidden />;
          }
          const item = items[idx];

          if (offset === 0) {
            return (
              <div key={offset} className={`${width} shrink-0`}>
                <LinkTile item={item} height="h-[22rem]" focused showInfo />
              </div>
            );
          }

          const dim = abs === 1 ? "opacity-70" : "opacity-40";
          const height = abs === 1 ? "h-[19rem]" : "h-[17rem]";
          return (
            <div key={offset} className={`${hideOnMobile} ${width} shrink-0 ${dim} transition-opacity hover:opacity-100`}>
              <button
                type="button"
                onClick={() => setFocus(idx)}
                aria-label={`Focus ${item.title}`}
                className="group block w-full border border-rule-border text-left"
              >
                <TileVisual item={item} height={height} />
              </button>
            </div>
          );
        })}
      </div>

      {items.length > 1 && (
        <>
          <StackArrow side="left" disabled={safeFocus === 0} onClick={() => setFocus(Math.max(0, safeFocus - 1))} />
          <StackArrow
            side="right"
            disabled={safeFocus === items.length - 1}
            onClick={() => setFocus(Math.min(items.length - 1, safeFocus + 1))}
          />
        </>
      )}
    </div>
  );
}

function StackArrow({ side, disabled, onClick }: { side: "left" | "right"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous" : "Next"}
      className={`absolute top-36 ${side === "left" ? "left-0" : "right-0"} z-10 flex h-11 w-11 items-center justify-center border-2 border-brand-accent bg-background text-lg font-extrabold text-brand-accent-light transition-colors hover:bg-brand-accent hover:text-brand-accent-foreground disabled:opacity-30 disabled:hover:bg-background disabled:hover:text-brand-accent-light`}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
}

function AnchorCarousel({ items }: { items: ContentItem[] }) {
  const [anchor, ...rest] = items;
  return (
    <div className="grid gap-4 lg:grid-cols-[24rem_minmax(0,1fr)]">
      <LinkTile item={anchor} height="h-[22rem]" focused showInfo />
      {rest.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {rest.map((item) => (
            <div key={item.id} className="w-56 shrink-0">
              <LinkTile item={item} height="h-[19rem]" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StripCarousel({ items }: { items: ContentItem[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {items.map((item) => (
        <div key={item.id} className="w-56 shrink-0">
          <LinkTile item={item} height="h-[19rem]" />
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------------- */

/** A card that links to its watch page: the dark tile, plus (when `showInfo`)
 *  the eyebrow / title / description block beneath it. `focused` paints the red
 *  border. */
function LinkTile({
  item,
  height,
  focused,
  showInfo,
}: {
  item: ContentItem;
  height: string;
  focused?: boolean;
  showInfo?: boolean;
}) {
  const border = focused ? "border-2 border-brand-accent" : "border border-rule-border";
  return (
    <Link href={`/content/${item.id}`} className={`group block ${border}`}>
      <TileVisual item={item} height={height} />
      {showInfo && (
        <div className="border-t-2 border-brand-accent p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-light-2">
            {eyebrowFor(item)}
          </p>
          <p className="mt-1 font-extrabold leading-tight tracking-tight">{item.title}</p>
          {item.summary && <p className="mt-1 line-clamp-2 text-sm text-muted">{item.summary}</p>}
        </div>
      )}
    </Link>
  );
}

/** The dark editorial tile: a big uppercase title over a dimmed poster, a WATCH
 *  chip + duration and a red play square at the foot. */
function TileVisual({ item, height }: { item: ContentItem; height: string }) {
  const duration = formatDuration(item.duration_seconds);
  return (
    <div className={`relative flex ${height} flex-col justify-between overflow-hidden bg-background p-5`}>
      {item.thumbnail_url && (
        // eslint-disable-next-line @next/next/no-img-element -- remote poster URL, not a local/optimizable asset
        <img
          src={item.thumbnail_url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-20 transition-opacity duration-300 group-hover:opacity-30"
        />
      )}
      <h3 className="relative text-xl font-extrabold uppercase leading-[0.95] tracking-tight sm:text-2xl">
        {item.title}
      </h3>
      <div className="relative mt-auto flex items-center justify-between pt-6">
        <span className="flex items-center gap-2">
          <span className="bg-brand-accent px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-brand-accent-foreground">
            Watch
          </span>
          {duration && <span className="text-xs font-semibold text-muted-on-ink-2">{duration}</span>}
        </span>
        <span className="flex h-9 w-9 items-center justify-center bg-brand-accent text-brand-accent-foreground transition-transform duration-200 group-hover:scale-110">
          <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </div>
    </div>
  );
}
