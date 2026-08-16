import { notFound } from "next/navigation";
import Link from "next/link";
import { requireHrAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getEventForAdmin, listBookingsForEvent } from "@/lib/events/queries";
import { EventStudioForm } from "@/components/admin/EventStudioForm";
import { EventAdminControls } from "@/components/admin/EventAdminControls";
import { EventRosterList } from "@/components/events/EventRoster";
import { formatEventWhen } from "@/lib/events/format";
import type { EventRow, EventBookingWithIdentity } from "@/types/database";

/** One company event's editor for HR: publish/cancel/delete, the roster, and an
 *  edit form. RLS returns the event only if it belongs to this admin's company. */
export default async function WorkspaceEventEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireHrAdmin();
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
  // RLS lets an hr_admin READ published global events too (public read policy),
  // so scope the editor to their OWN company -- a global/other-company id 404s
  // rather than rendering an editor whose buttons would all no-op.
  if (!event || event.company_id !== profile.company_id) notFound();

  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const waitlisted = bookings.filter((b) => b.status === "waitlisted");
  const cap = event.capacity;

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <Link
        href="/workspace/events"
        className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-deep hover:underline"
      >
        ← Your events
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
          backHref="/workspace/events"
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
          <EventRosterList rows={confirmed} />
        </div>
        {waitlisted.length > 0 && (
          <div className="mt-6">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">Waitlist</p>
            <EventRosterList rows={waitlisted} />
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
