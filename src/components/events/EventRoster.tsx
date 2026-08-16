import type { EventBookingWithIdentity } from "@/types/database";

function bookingName(b: EventBookingWithIdentity): string {
  if (b.user_id) return b.member?.display_name ?? "Member";
  return b.guest_name ?? b.guest_email ?? "Guest";
}

/** A numbered roster of bookings (confirmed or waitlist), shared by the admin
 *  Studio and the HR Workspace event editors. Members show their name; guests
 *  show name + email. */
export function EventRosterList({ rows }: { rows: EventBookingWithIdentity[] }) {
  if (rows.length === 0) return <p className="mt-2 text-sm text-muted">No one yet.</p>;
  return (
    <ol className="mt-2 divide-y divide-rule-hairline border-t border-rule-hairline">
      {rows.map((b, i) => (
        <li key={b.id} className="flex items-center gap-3 py-2 text-sm">
          <span className="w-5 shrink-0 text-right text-[11px] font-semibold text-muted">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate font-semibold">{bookingName(b)}</span>
          {b.user_id ? (
            <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-muted">Member</span>
          ) : (
            <span className="shrink-0 truncate text-[11px] text-muted">{b.guest_email ?? "Guest"}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
