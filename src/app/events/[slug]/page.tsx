import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOptionalProfile } from "@/lib/auth/dal";
import { getEventBySlugForMember, getPublicEventBySlug } from "@/lib/events/queries";
import { EventBookButton } from "@/components/events/EventBookButton";
import { formatEventWhen } from "@/lib/events/format";
import type { EventRow, EventBookingStatus } from "@/types/database";

type DetailEvent = EventRow & { my_booking_status?: EventBookingStatus | null };

/**
 * Event detail, for members and the public alike. A signed-in member gets the
 * booking control; a visitor gets a "sign in to book" call to action. The event
 * is fetched through the caller's own client, so RLS decides visibility (a
 * visitor only ever resolves a published GLOBAL event).
 */
export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const profile = await getOptionalProfile();
  const { slug } = await params;

  let event: DetailEvent | null = null;
  try {
    const supabase = await createClient();
    event = profile
      ? await getEventBySlugForMember(supabase, slug, profile.id)
      : await getPublicEventBySlug(supabase, slug);
  } catch {
    event = null;
  }
  if (!event) notFound();

  const isCancelled = Boolean(event.cancelled_at);
  const isPast = new Date(event.starts_at) < new Date();
  const isFull = event.capacity != null && event.confirmed_count >= event.capacity;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/events"
        className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-deep hover:underline"
      >
        ← All events
      </Link>

      {event.image_url && (
        <div className="mt-5 aspect-[16/9] w-full overflow-hidden border border-rule-border">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-pasted URL, not a local/optimizable asset */}
          <img src={event.image_url} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-deep">
        {formatEventWhen(event.starts_at, event.ends_at)}
      </p>
      <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight">{event.title}</h1>

      {event.location_name && (
        <p className="mt-2 text-sm text-muted">
          {event.location_url ? (
            <a
              href={event.location_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-2 hover:text-foreground"
            >
              {event.location_name} ↗
            </a>
          ) : (
            event.location_name
          )}
        </p>
      )}

      {event.capacity != null && (
        <p className="mt-1 text-sm text-muted">
          {event.confirmed_count} / {event.capacity} booked
          {isFull && !isCancelled ? " — join the waitlist" : ""}
        </p>
      )}

      {event.description && (
        <div className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">
          {event.description}
        </div>
      )}

      <div className="mt-8 border-t border-rule-hairline pt-6">
        {isCancelled ? (
          <p className="border-l-2 border-brand-accent-deep pl-4 text-sm font-semibold text-brand-accent-deep">
            This event has been cancelled.
          </p>
        ) : isPast ? (
          <p className="text-sm text-muted">This event has already taken place.</p>
        ) : profile ? (
          <EventBookButton
            eventId={event.id}
            slug={event.slug}
            myStatus={event.my_booking_status ?? null}
            isFull={isFull}
          />
        ) : (
          <div className="space-y-3">
            <Link
              href={`/login?next=${encodeURIComponent(`/events/${event.slug}`)}`}
              className="inline-flex bg-brand-accent px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground transition-opacity hover:opacity-90"
            >
              {isFull ? "Sign in to join the waitlist" : "Sign in to book"}
            </Link>
            <p className="text-sm text-muted">
              New here?{" "}
              <Link href="/signup" className="font-semibold underline underline-offset-2 hover:text-foreground">
                Create your account
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
