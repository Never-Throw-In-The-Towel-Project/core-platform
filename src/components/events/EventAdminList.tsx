"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { eventDateParts, formatEventTimeRange } from "@/lib/events/format";
import { eventStatus, EventStatusBadge } from "./EventStatusBadge";
import { CapacityMeter } from "./CapacityMeter";
import type { EventRow } from "@/types/database";

type Filter = "all" | "published" | "drafts" | "cancelled";

const TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "drafts", label: "Drafts" },
  { key: "cancelled", label: "Cancelled" },
];

function matchesFilter(e: EventRow, f: Filter): boolean {
  if (f === "all") return true;
  if (f === "cancelled") return Boolean(e.cancelled_at);
  if (e.cancelled_at) return false;
  if (f === "published") return e.is_published;
  return !e.is_published; // drafts
}

function endRefMs(e: EventRow): number {
  return new Date(e.ends_at ?? e.starts_at).getTime();
}

function DateBlock({ startsAt }: { startsAt: string }) {
  const { weekday, day, month } = eventDateParts(startsAt);
  return (
    <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center border border-rule-hairline bg-background text-center">
      <span className="text-[9px] font-extrabold uppercase tracking-widest text-brand-accent-deep">{weekday}</span>
      <span className="text-xl font-extrabold leading-none">{day}</span>
      <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted">{month}</span>
    </div>
  );
}

function EventRowLink({ e, basePath, nowMs }: { e: EventRow; basePath: string; nowMs: number }) {
  return (
    <li>
      <Link
        href={`${basePath}/${e.id}`}
        className="group flex items-stretch gap-4 border border-rule-border p-3 transition-colors hover:border-foreground"
      >
        {e.image_url ? (
          <div className="h-16 w-16 shrink-0 overflow-hidden border border-rule-hairline">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin-pasted URL, not a local/optimizable asset */}
            <img src={e.image_url} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <DateBlock startsAt={e.starts_at} />
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="flex items-start justify-between gap-3">
            <h4 className="min-w-0 truncate font-extrabold leading-tight tracking-tight group-hover:text-brand-accent-deep">
              {e.title}
            </h4>
            <EventStatusBadge status={eventStatus(e, nowMs)} />
          </div>
          <p className="mt-0.5 truncate text-[11px] font-semibold uppercase tracking-wide text-muted">
            {formatEventTimeRange(e.starts_at, e.ends_at)}
            {e.location_name ? ` · ${e.location_name}` : ""}
          </p>
          <CapacityMeter confirmed={e.confirmed_count} capacity={e.capacity} className="mt-2 max-w-[16rem]" />
        </div>
      </Link>
    </li>
  );
}

/**
 * The admin/HR events list: filter tabs (with live counts), an Upcoming / Past
 * split within the selection, and rich rows (thumbnail or date block, status,
 * capacity meter). `basePath` is where a row links to (/admin/events or
 * /workspace/events); `nowMs` is passed from the server so the SSR and client
 * agree on the upcoming/past boundary (no hydration drift).
 */
export function EventAdminList({
  events,
  basePath,
  nowMs,
}: {
  events: EventRow[];
  basePath: string;
  nowMs: number;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, published: 0, drafts: 0, cancelled: 0 };
    for (const e of events) for (const t of TABS) if (matchesFilter(e, t.key)) c[t.key] += 1;
    return c;
  }, [events]);

  const { upcoming, past } = useMemo(() => {
    const filtered = events.filter((e) => matchesFilter(e, filter));
    const up = filtered
      .filter((e) => endRefMs(e) >= nowMs)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    const pa = filtered
      .filter((e) => endRefMs(e) < nowMs)
      .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
    return { upcoming: up, past: pa };
  }, [events, filter, nowMs]);

  const empty = upcoming.length === 0 && past.length === 0;

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-rule-hairline" role="tablist" aria-label="Filter events">
        {TABS.map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(t.key)}
              className={
                "-mb-px border-b-2 px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] transition-colors " +
                (active
                  ? "border-brand-accent-vivid text-foreground"
                  : "border-transparent text-muted hover:text-foreground")
              }
            >
              {t.label} <span className="text-muted">{counts[t.key]}</span>
            </button>
          );
        })}
      </div>

      {empty ? (
        <p className="mt-4 text-sm text-muted">
          {filter === "all" ? "Nothing yet — create your first above." : `No ${filter} events.`}
        </p>
      ) : (
        <div className="mt-4 space-y-6">
          {upcoming.length > 0 && (
            <section>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
                Upcoming <span className="text-brand-accent-deep">{upcoming.length}</span>
              </p>
              <ul className="mt-2 space-y-2">
                {upcoming.map((e) => (
                  <EventRowLink key={e.id} e={e} basePath={basePath} nowMs={nowMs} />
                ))}
              </ul>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
                Past <span className="text-muted">{past.length}</span>
              </p>
              <ul className="mt-2 space-y-2">
                {past.map((e) => (
                  <EventRowLink key={e.id} e={e} basePath={basePath} nowMs={nowMs} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
