import { notFound } from "next/navigation";
import Link from "next/link";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getEventForAdmin, listBookingsForEvent } from "@/lib/events/queries";
import { EventStudioForm } from "@/components/admin/EventStudioForm";
import { EventAdminControls } from "@/components/admin/EventAdminControls";
import { EventRosterPanel } from "@/components/events/EventRosterPanel";
import { eventStatus, EventStatusBadge } from "@/components/events/EventStatusBadge";
import { formatEventWhen } from "@/lib/events/format";
import type { EventRow, EventBookingWithIdentity } from "@/types/database";

const SECTION_HEADING = "border-b-2 border-foreground pb-2 text-[11px] font-extrabold uppercase tracking-[0.16em]";

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

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
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
        <EventStatusBadge status={eventStatus(event, new Date().getTime())} />
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
          bookingCount={bookings.length}
        />
      </div>

      <section className="mt-10">
        <h2 className={SECTION_HEADING}>Bookings</h2>
        <div className="mt-4">
          <EventRosterPanel
            eventId={event.id}
            confirmed={confirmed}
            waitlisted={waitlisted}
            capacity={event.capacity}
          />
        </div>
      </section>

      <section className="mt-12">
        <h2 className={SECTION_HEADING}>Edit event</h2>
        <div className="mt-5">
          <EventStudioForm event={event} />
        </div>
      </section>
    </main>
  );
}
