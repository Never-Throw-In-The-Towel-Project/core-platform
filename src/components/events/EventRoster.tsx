"use client";

import { useState } from "react";
import type { EventBookingWithIdentity } from "@/types/database";

function bookingName(b: EventBookingWithIdentity): string {
  if (b.user_id) return b.member?.display_name ?? "Member";
  return b.guest_name ?? b.guest_email ?? "Guest";
}

/**
 * A numbered roster of bookings (confirmed or waitlist), shared by the admin
 * Studio and the HR Workspace event editors. Members show their name; guests
 * show name + email.
 *
 * When `onRemove`/`onPromote` are passed (the organiser editors), each row gets
 * management controls: Remove (two-click confirm, since it's destructive) on any
 * row, and Promote on waitlist rows. Omitting the handlers renders a plain list.
 */
export function EventRosterList({
  rows,
  onRemove,
  onPromote,
  pendingId,
}: {
  rows: EventBookingWithIdentity[];
  onRemove?: (bookingId: string) => void;
  onPromote?: (bookingId: string) => void;
  /** The booking currently being acted on, to disable its controls. */
  pendingId?: string | null;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (rows.length === 0) return <p className="mt-2 text-sm text-muted">No one yet.</p>;
  const manageable = Boolean(onRemove || onPromote);

  return (
    <ol className="mt-2 divide-y divide-rule-hairline border-t border-rule-hairline">
      {rows.map((b, i) => {
        const pending = pendingId === b.id;
        const confirming = confirmingId === b.id;
        return (
          <li key={b.id} className="flex items-center gap-3 py-2 text-sm">
            <span className="w-5 shrink-0 text-right text-[11px] font-semibold text-muted">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">{bookingName(b)}</span>
            {b.user_id ? (
              <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-muted">Member</span>
            ) : (
              <span className="shrink-0 truncate text-[11px] text-muted">{b.guest_email ?? "Guest"}</span>
            )}

            {manageable && (
              <span className="flex shrink-0 items-center gap-1">
                {onPromote && (
                  <button
                    type="button"
                    onClick={() => onPromote(b.id)}
                    disabled={pending}
                    className="inline-flex min-h-[32px] items-center px-2 text-[11px] font-extrabold uppercase tracking-wide text-brand-accent-deep hover:underline disabled:opacity-40"
                  >
                    {pending ? "…" : "Promote"}
                  </button>
                )}
                {onRemove &&
                  (confirming ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmingId(null);
                          onRemove(b.id);
                        }}
                        disabled={pending}
                        className="inline-flex min-h-[32px] items-center px-2 text-[11px] font-extrabold uppercase tracking-wide text-brand-accent-deep hover:underline disabled:opacity-40"
                      >
                        {pending ? "…" : "Confirm"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        disabled={pending}
                        className="inline-flex min-h-[32px] items-center px-2 text-[11px] font-semibold uppercase tracking-wide text-muted hover:text-foreground disabled:opacity-40"
                      >
                        Keep
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(b.id)}
                      disabled={pending}
                      className="inline-flex min-h-[32px] items-center px-2 text-[11px] font-semibold uppercase tracking-wide text-muted hover:text-foreground disabled:opacity-40"
                    >
                      Remove
                    </button>
                  ))}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
