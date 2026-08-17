import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOptionalProfile } from "@/lib/auth/dal";
import { listUpcomingEventsForMember, listPublicUpcomingEvents } from "@/lib/events/queries";
import { EventPublicCard } from "@/components/events/EventPublicCard";
import type { EventRow, EventBookingStatus } from "@/types/database";

export const metadata = {
  title: "Events — Never Throw In The Towel",
  description: "Real-world meet-ups — cold-water dips, walks and socials — you can book onto.",
};

type EventCard = EventRow & { my_booking_status?: EventBookingStatus | null };

/**
 * Events — one URL for members and the public alike (the layout supplies the app
 * shell for a signed-in member, the marketing shell for a visitor). A member's
 * own booking status decorates each card; a visitor sees capacity only and books
 * from the detail page after signing in.
 */
export default async function EventsPage() {
  const profile = await getOptionalProfile();
  // Treat a logged-in-but-not-onboarded user as a visitor, matching the layout
  // (which gates the app shell on onboarding_completed): otherwise they'd get the
  // marketing chrome wrapping member data + the one-tap member booking path.
  const member = Boolean(profile?.onboarding_completed);

  let events: EventCard[] = [];
  try {
    const supabase = await createClient();
    events = member ? await listUpcomingEventsForMember(supabase) : await listPublicUpcomingEvents(supabase);
  } catch {
    events = [];
  }

  return (
    <main className="min-h-full">
      <section className="bg-brand-background text-brand-foreground">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-light-2">Events</p>
          <h1 className="mt-2 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Come and be part of it.
          </h1>
          <p className="mt-4 max-w-lg text-muted-on-ink-2">
            Cold-water dips, walks and meet-ups — get out of your own head and among people who get it.
          </p>
          {!member && (
            <p className="mt-4 text-sm text-muted-on-ink-2">
              Free to join —{" "}
              <Link href="/login" className="font-bold text-brand-accent-light-2 underline underline-offset-2">
                sign in
              </Link>{" "}
              to book your spot.
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {events.length === 0 ? (
          <div className="border border-rule-border px-6 py-12 text-center">
            <p className="text-sm font-semibold">No events coming up just yet.</p>
            <p className="mt-1 text-sm text-muted">Check back soon — new meet-ups are added regularly.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <li key={e.id}>
                <EventPublicCard event={e} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
