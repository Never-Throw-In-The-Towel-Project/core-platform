import Link from "next/link";
import { type ReactNode } from "react";
import type { CoverageGaps } from "@/lib/content/coverage";
import type { ContentType, VideoCategory } from "@/types/database";

/**
 * Presentational building blocks for the Super Admin Overview. Deliberately pure
 * (no data, no server-only imports) so the dashboard can be rendered in
 * isolation for a headless render check and so the layout logic stays testable
 * by eye. All Modernist tokens (globals.css) — flat, square, no shadows.
 */

/** A section heading on the heavy ink rule the admin pages use, with an optional
 *  count in accent red. Mirrors the Content Studio / Companies heading pattern. */
export function SectionHeading({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <h2 className="flex items-baseline gap-2 border-b-2 border-foreground pb-2 text-[11px] font-extrabold uppercase tracking-[0.16em]">
      <span>{children}</span>
      {count != null && <span className="text-brand-accent-deep tabular-nums">{count}</span>}
    </h2>
  );
}

/** A single KPI tile. Optional `href` makes it a link into the relevant admin
 *  section; `accent` colours the number red to flag something needing attention
 *  (drafts waiting, reports open). */
export function StatTile({
  value,
  label,
  hint,
  accent = false,
  href,
}: {
  value: number | string;
  label: string;
  hint?: string;
  accent?: boolean;
  href?: string;
}) {
  const inner = (
    <>
      <p className={`text-3xl font-extrabold tabular-nums ${accent ? "text-brand-accent-deep" : ""}`}>{value}</p>
      <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">{label}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="block border border-rule-border p-4 transition-colors hover:border-brand-accent hover:bg-foreground/[0.03]"
    >
      {inner}
    </Link>
  ) : (
    <div className="border border-rule-border p-4">{inner}</div>
  );
}

/** A labelled horizontal proportion bar (e.g. content by type). `max` sets the
 *  100% reference so a row of bars share a scale. Decorative fill only. */
export function ProportionBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 truncate text-xs text-muted">{label}</span>
      <div className="h-2 flex-1 bg-foreground/10">
        <div className="h-full bg-brand-accent-vivid" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right font-semibold tabular-nums">{count}</span>
    </div>
  );
}

/** A compact vertical bar chart (e.g. sign-ups per week). Bars scale to the max
 *  in the series against a fixed-height track; the latest bar is emphasised in
 *  accent, and the counts sit in their own row below. Decorative fill only. */
export function MiniBars({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      <div className="flex h-16 items-end gap-1.5">
        {data.map((d, i) => {
          const isLast = i === data.length - 1;
          const pct = Math.round((d.count / max) * 100);
          return (
            <div key={`bar-${d.label}-${i}`} className="flex h-full flex-1 items-end">
              <div
                className={`w-full ${isLast ? "bg-brand-accent-vivid" : "bg-foreground/15"}`}
                style={{ height: `${d.count > 0 ? Math.max(pct, 4) : 0}%` }}
                title={`${d.label}: ${d.count}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1.5">
        {data.map((d, i) => (
          <span key={`n-${d.label}-${i}`} className="flex-1 text-center text-[9px] font-semibold tabular-nums text-muted">
            {d.count}
          </span>
        ))}
      </div>
    </div>
  );
}

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"]; // ISO 1..7 (Mon..Sun)

const THEME_LABEL: Record<VideoCategory, string> = {
  mental_fitness: "Mental Fitness",
  physical_fitness: "Physical Fitness",
  nutrition: "Nutrition",
  tools_tips: "Tools & Tips",
};

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  video: "Video",
  document: "Document",
  image: "Image",
  text: "Text",
};

/**
 * The published-content coverage view: a 7-cell Mon–Sun strip (filled where a
 * day has day-tagged published content), the four themes with counts, and a
 * plain-language "thin" note. Mirrors the Content Studio coverage grid so the
 * two surfaces read the same. Published only — a draft isn't coverage yet.
 */
export function CoverageStrip({ coverage }: { coverage: CoverageGaps }) {
  const themeMax = Math.max(1, ...coverage.perTheme.map((t) => t.count));
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">By day · published</p>
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {coverage.perDay.map((d, i) => (
            <div
              key={d.day}
              className={`flex aspect-square flex-col items-center justify-center gap-0.5 ${
                d.count > 0 ? "bg-brand-accent text-brand-accent-foreground" : "border border-rule-border text-muted"
              }`}
              title={`${d.count} item${d.count === 1 ? "" : "s"} tagged for this day`}
            >
              <span className="text-[10px] font-extrabold uppercase">{DAY_LETTERS[i]}</span>
              <span className="text-sm font-extrabold tabular-nums">{d.count}</span>
            </div>
          ))}
        </div>
        {coverage.emptyDays.length > 0 ? (
          <p className="mt-2 text-xs text-muted">
            {coverage.emptyDays.length} day{coverage.emptyDays.length === 1 ? "" : "s"} with no day-tagged content.
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted">Every day has content.</p>
        )}
      </div>
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">By theme · published</p>
        <div className="mt-2 space-y-2">
          {coverage.perTheme.map((t) => (
            <ProportionBar key={t.theme} label={THEME_LABEL[t.theme]} count={t.count} max={themeMax} />
          ))}
        </div>
        {coverage.emptyThemes.length > 0 ? (
          <p className="mt-2 text-xs text-muted">
            Thin: {coverage.emptyThemes.map((t) => THEME_LABEL[t]).join(", ")}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
