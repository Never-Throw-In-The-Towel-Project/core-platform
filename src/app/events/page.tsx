import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOptionalProfile } from "@/lib/auth/dal";
import { listUpcomingEventsForMember, listPublicUpcomingEvents } from "@/lib/events/queries";
import { formatEventWhen } from "@/lib/events/format";
import type { EventRow, EventBookingStatus } from "@/types/database";

export const metadata = {
  title: "Events — Never Throw In The Towel",
  description: "Real-world meet-ups — cold-water dips, walks and socials — you can book onto.",
};

type EventCard = EventRow & { my_booking_status?: EventBookingStatus | null };

function statusChip(e: EventCard): { label: string; className: string } {
  if (e.my_booking_status === "confirmed") return { label: "Booked", className: "border-foreground text-foreground" };
  if (e.my_booking_status === "waitlisted") return { label: "Waitlisted", className: "border-rule-border text-muted" };
  if (e.capacity != null) {
    const left = e.capacity - e.confirmed_count;
    if (left <= 0) return { label: "Full — waitlist", className: "border-brand-accent-deep text-brand-accent-deep" };
    return { label: `${left} spot${left === 1 ? "" : "s"} left`, className: "border-rule-border text-muted" };
  }
  return { label: "Open", className: "border-rule-border text-muted" };
}

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
          <p className="py-8 text-sm text-muted">No events coming up just yet — check back soon.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {events.map((e) => {
              const chip = statusChip(e);
              return (
                <li key={e.id}>
                  <Link
                    href={`/events/${e.slug}`}
                    className="group flex h-full flex-col border border-rule-border transition-colors hover:border-foreground"
                  >
                    {e.image_url ? (
                      <div className="aspect-[16/9] w-full overflow-hidden border-b border-rule-border">
                        {/* eslint-disable-next-line @next/next/no-img-element -- admin-pasted URL, not a local/optimizable asset */}
                        <img src={e.image_url} alt="" className="h-full w-full object-cover" />
                      </div>
                    ) : null}
                    <div className="flex flex-1 flex-col p-5">
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep">
                        {formatEventWhen(e.starts_at, e.ends_at)}
                      </p>
                      <h2 className="mt-1.5 font-extrabold leading-tight tracking-tight group-hover:text-brand-accent-deep">
                        {e.title}
                      </h2>
                      {e.location_name && <p className="mt-1 text-sm text-muted">{e.location_name}</p>}
                      {e.summary && <p className="mt-2 line-clamp-2 text-sm text-muted">{e.summary}</p>}
                      <span
                        className={
                          "mt-4 inline-flex w-fit border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] " +
                          chip.className
                        }
                      >
                        {chip.label}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
