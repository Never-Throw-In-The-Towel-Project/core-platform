"use client";

import { useMemo, useState } from "react";
import { CapacityMeter } from "./CapacityMeter";
import { EventRosterList } from "./EventRoster";
import type { EventBookingWithIdentity } from "@/types/database";

function rowName(b: EventBookingWithIdentity): string {
  if (b.user_id) return b.member?.display_name ?? "Member";
  return b.guest_name ?? b.guest_email ?? "Guest";
}

function rowEmail(b: EventBookingWithIdentity): string {
  return b.user_id ? "" : (b.guest_email ?? "");
}

function matches(b: EventBookingWithIdentity, q: string): boolean {
  if (!q) return true;
  const hay = `${rowName(b)} ${rowEmail(b)}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

function csvSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "event"
  );
}

function toCsv(rows: EventBookingWithIdentity[], statusOf: (b: EventBookingWithIdentity) => string): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const header = ["Status", "Name", "Email", "Type", "Booked at"].map(esc).join(",");
  const lines = rows.map((b) =>
    [statusOf(b), rowName(b), rowEmail(b), b.user_id ? "Member" : "Guest", b.created_at]
      .map((v) => esc(String(v)))
      .join(",")
  );
  return [header, ...lines].join("\r\n");
}

/**
 * The attendee roster with a live filter and a CSV export. The confirmed and
 * waitlist rows come pre-split from the server (RLS-authorised admin read);
 * search only narrows what's shown, and the export always covers the full
 * roster (confirmed first, then waitlist) so an organiser can take a register.
 */
export function EventRosterPanel({
  eventTitle,
  confirmed,
  waitlisted,
  capacity,
}: {
  eventTitle: string;
  confirmed: EventBookingWithIdentity[];
  waitlisted: EventBookingWithIdentity[];
  capacity: number | null;
}) {
  const [query, setQuery] = useState("");

  const shownConfirmed = useMemo(() => confirmed.filter((b) => matches(b, query)), [confirmed, query]);
  const shownWaitlisted = useMemo(() => waitlisted.filter((b) => matches(b, query)), [waitlisted, query]);
  const total = confirmed.length + waitlisted.length;

  function exportCsv() {
    const rows = [...confirmed, ...waitlisted];
    const csv = toCsv(rows, (b) => (waitlisted.includes(b) ? "Waitlist" : "Confirmed"));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${csvSlug(eventTitle)}-roster.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {confirmed.length}
            {capacity != null ? ` / ${capacity}` : ""} confirmed
            {waitlisted.length > 0 ? ` · ${waitlisted.length} on the waitlist` : ""}
          </p>
          <CapacityMeter confirmed={confirmed.length} capacity={capacity} className="mt-2 max-w-xs" />
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={total === 0}
          className="border border-rule-border px-4 py-2 text-xs font-extrabold uppercase tracking-wide transition-colors hover:bg-foreground/[0.04] disabled:opacity-40"
        >
          Export CSV
        </button>
      </div>

      {total > 0 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email…"
          aria-label="Search the roster"
          className="mt-4 w-full border border-rule-border bg-transparent px-3 py-2 text-sm placeholder:text-muted/60"
        />
      )}

      <div className="mt-4">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">Confirmed</p>
        {query && shownConfirmed.length === 0 && confirmed.length > 0 ? (
          <p className="mt-2 text-sm text-muted">No confirmed bookings match “{query}”.</p>
        ) : (
          <EventRosterList rows={shownConfirmed} />
        )}
      </div>

      {waitlisted.length > 0 && (
        <div className="mt-6">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">Waitlist</p>
          {query && shownWaitlisted.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No waitlisters match “{query}”.</p>
          ) : (
            <EventRosterList rows={shownWaitlisted} />
          )}
        </div>
      )}
    </div>
  );
}
