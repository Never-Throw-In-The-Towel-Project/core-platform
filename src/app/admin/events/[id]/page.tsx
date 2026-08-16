import { notFound } from "next/navigation";
import Link from "next/link";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getEventForAdmin, listBookingsForEvent } from "@/lib/events/queries";
import { EventStudioForm } from "@/components/admin/EventStudioForm";
import { EventAdminControls } from "@/components/admin/EventAdminControls";
import { formatEventWhen } from "@/lib/events/format";
import type { EventRow, EventBookingWithIdentity } from "@/types/database";

function bookingName(b: EventBookingWithIdentity): string {
  if (b.user_id) return b.member?.display_name ?? "Member";
  return b.guest_name ?? b.guest_email ?? "Guest";
}

function RosterList({ rows }: { rows: EventBookingWithIdentity[] }) {
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

/** One event's editor: publish/cancel/delete controls, the booking roster, and an edit form. ntitt_admin only. */
export default async function AdminEventEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireNtittAdmin();
  const { id } = await params;

  let event: EventRow | null = null;
  let bookings: EventBookingWithIdentity[] = [];
  try {
    const supabase = await createClient();
    event = await getEventForAdmin(supabase, id);
    if (event) bookings = await listBookingsForEvent(supabase, id);
  } catch {
    event = null;
  }
  if (!event) notFound();

  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const waitlisted = bookings.filter((b) => b.status === "waitlisted");
  const cap = event.capacity;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/admin/events"
        className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-deep hover:underline"
      >
        ← All events
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight">{event.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {formatEventWhen(event.starts_at, event.ends_at)}
            {event.location_name ? ` · ${event.location_name}` : ""}
          </p>
        </div>
        <span
          className={
            "shrink-0 border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] " +
            (event.cancelled_at
              ? "border-brand-accent-deep text-brand-accent-deep"
              : event.is_published
                ? "border-rule-border text-muted"
                : "border-brand-accent bg-brand-accent text-brand-accent-foreground")
          }
        >
          {event.cancelled_at ? "Cancelled" : event.is_published ? "Live" : "Draft"}
        </span>
      </div>
      <p className="mt-2">
        <Link
          href={`/events/${event.slug}`}
          className="text-xs font-semibold text-muted underline underline-offset-2 hover:text-foreground"
        >
          Preview member view →
        </Link>
      </p>

      <div className="mt-6">
        <EventAdminControls
          eventId={event.id}
          isPublished={event.is_published}
          isCancelled={Boolean(event.cancelled_at)}
        />
      </div>

      <section className="mt-10">
        <h2 className="border-b-2 border-foreground pb-2 text-[11px] font-extrabold uppercase tracking-[0.16em]">
          Bookings
        </h2>
        <p className="mt-3 text-sm font-semibold">
          {confirmed.length}
          {cap != null ? ` / ${cap}` : ""} confirmed
          {waitlisted.length > 0 ? ` · ${waitlisted.length} on the waitlist` : ""}
        </p>

        <div className="mt-4">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">Confirmed</p>
          <RosterList rows={confirmed} />
        </div>
        {waitlisted.length > 0 && (
          <div className="mt-6">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">Waitlist</p>
            <RosterList rows={waitlisted} />
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="border-b-2 border-foreground pb-2 text-[11px] font-extrabold uppercase tracking-[0.16em]">
          Edit event
        </h2>
        <div className="mt-4">
          <EventStudioForm event={event} />
        </div>
      </section>
    </main>
  );
}
