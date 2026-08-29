"use client";

import { useMemo, useState, useTransition } from "react";
import { exportEventRoster } from "@/lib/actions/events";
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

/** Trigger a browser download of a CSV string the server assembled. */
function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * The attendee roster with a live filter and a CSV export. The confirmed and
 * waitlist rows come pre-split from the server (RLS-authorised admin read);
 * search only narrows what's shown, and the export always covers the full
 * roster (confirmed first, then waitlist) so an organiser can take a register.
 */
export function EventRosterPanel({
  eventId,
  confirmed,
  waitlisted,
  capacity,
}: {
  eventId: string;
  confirmed: EventBookingWithIdentity[];
  waitlisted: EventBookingWithIdentity[];
  capacity: number | null;
}) {
  const [query, setQuery] = useState("");
  const [exporting, startExport] = useTransition();
  const [exportError, setExportError] = useState<string | null>(null);

  const shownConfirmed = useMemo(() => confirmed.filter((b) => matches(b, query)), [confirmed, query]);
  const shownWaitlisted = useMemo(() => waitlisted.filter((b) => matches(b, query)), [waitlisted, query]);
  const total = confirmed.length + waitlisted.length;

  // The CSV is assembled server-side (exportEventRoster) so it can fill in member
  // emails, which live on auth.users and never reach this client component.
  function exportCsv() {
    setExportError(null);
    startExport(async () => {
      const res = await exportEventRoster(eventId);
      if ("error" in res) {
        setExportError(res.error);
        return;
      }
      downloadCsv(res.csv, res.filename);
    });
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
          disabled={total === 0 || exporting}
          className="border border-rule-border px-4 py-2 text-xs font-extrabold uppercase tracking-wide transition-colors hover:bg-foreground/[0.04] disabled:opacity-40"
        >
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>
      {exportError && (
        <p role="alert" className="mt-2 text-xs font-semibold text-brand-accent-deep">
          {exportError}
        </p>
      )}

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
