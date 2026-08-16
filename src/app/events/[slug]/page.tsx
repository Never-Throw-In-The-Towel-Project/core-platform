import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOptionalProfile } from "@/lib/auth/dal";
import { getEventBySlugForMember, getPublicEventBySlug } from "@/lib/events/queries";
import { EventBookButton } from "@/components/events/EventBookButton";
import { GuestBookingForm } from "@/components/events/GuestBookingForm";
import { formatEventWhen } from "@/lib/events/format";
import type { EventRow, EventBookingStatus } from "@/types/database";

type DetailEvent = EventRow & { my_booking_status?: EventBookingStatus | null };

// Banner shown after a guest returns from a confirm/cancel email link (?guest=…).
function guestBanner(flag: string | undefined): { text: string; tone: "good" | "muted" | "error" } | null {
  switch (flag) {
    case "confirmed":
      return { text: "You’re booked in — see you there. We’ve emailed you the details.", tone: "good" };
    case "waitlisted":
      return { text: "You’re on the waitlist — we’ll email you the moment a place frees up.", tone: "good" };
    case "cancelled":
      return { text: "Your booking’s cancelled. You can book again any time.", tone: "muted" };
    case "error":
      return { text: "That link didn’t work. Please book again below.", tone: "error" };
    default:
      return null;
  }
}

/**
 * Event detail, for members and the public alike. A signed-in member gets the
 * booking control; a visitor gets a "sign in to book" call to action. The event
 * is fetched through the caller's own client, so RLS decides visibility (a
 * visitor only ever resolves a published GLOBAL event).
 */
export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ guest?: string }>;
}) {
  const profile = await getOptionalProfile();
  // A logged-in-but-not-onboarded user is treated as a visitor here, matching the
  // layout's app-shell gate (see the list page for the full rationale).
  const member = profile && profile.onboarding_completed ? profile : null;
  const { slug } = await params;
  const banner = guestBanner((await searchParams).guest);

  let event: DetailEvent | null = null;
  try {
    const supabase = await createClient();
    event = member
      ? await getEventBySlugForMember(supabase, slug, member.id)
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

      {banner && (
        <p
          className={
            "mt-5 border-l-2 pl-4 text-sm font-semibold " +
            (banner.tone === "good"
              ? "border-foreground text-foreground"
              : banner.tone === "error"
                ? "border-brand-accent-deep text-brand-accent-deep"
                : "border-rule-border text-muted")
          }
          role="status"
        >
          {banner.text}
        </p>
      )}

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
        ) : member ? (
          <EventBookButton
            eventId={event.id}
            slug={event.slug}
            myStatus={event.my_booking_status ?? null}
            isFull={isFull}
          />
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Link
                href={`/login?next=${encodeURIComponent(`/events/${event.slug}`)}`}
                className="inline-flex bg-brand-accent px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground transition-opacity hover:opacity-90"
              >
                {isFull ? "Sign in to join the waitlist" : "Sign in to book"}
              </Link>
              <p className="text-sm text-muted">Already a member? Sign in for one-tap booking.</p>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
              <span className="h-px flex-1 bg-rule-hairline" /> or <span className="h-px flex-1 bg-rule-hairline" />
            </div>

            <GuestBookingForm eventId={event.id} slug={event.slug} isFull={isFull} />
          </div>
        )}
      </div>
    </main>
  );
}
