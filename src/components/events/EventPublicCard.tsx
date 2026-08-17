import Link from "next/link";
import { eventDateParts, formatEventWhen } from "@/lib/events/format";
import type { EventRow, EventBookingStatus } from "@/types/database";

type CardEvent = EventRow & { my_booking_status?: EventBookingStatus | null };

/** The status chip shown on a member/public card: the member's own booking
 *  state wins, else the remaining capacity. */
function chip(e: CardEvent): { label: string; className: string } {
  if (e.my_booking_status === "confirmed") return { label: "Booked", className: "border-foreground text-foreground" };
  if (e.my_booking_status === "waitlisted")
    return { label: "Waitlisted", className: "border-rule-border text-muted" };
  if (e.capacity != null) {
    const left = e.capacity - e.confirmed_count;
    if (left <= 0) return { label: "Full — waitlist", className: "border-brand-accent-deep text-brand-accent-deep" };
    return { label: `${left} spot${left === 1 ? "" : "s"} left`, className: "border-rule-border text-muted" };
  }
  return { label: "Open", className: "border-rule-border text-muted" };
}

/** An event card for the members' + public events list. When there's no image,
 *  a branded ink date-block stands in so every card still reads strongly. */
export function EventPublicCard({ event }: { event: CardEvent }) {
  const c = chip(event);
  const { weekday, day, month } = eventDateParts(event.starts_at);

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex h-full flex-col border border-rule-border transition-colors hover:border-foreground"
    >
      {event.image_url ? (
        <div className="aspect-[16/9] w-full overflow-hidden border-b border-rule-border">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-pasted URL, not a local/optimizable asset */}
          <img src={event.image_url} alt="" className="site-photo h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex aspect-[16/9] w-full flex-col items-center justify-center border-b border-rule-border bg-brand-background text-brand-foreground">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-accent-light-2">
            {weekday}
          </span>
          <span className="text-4xl font-extrabold leading-none">{day}</span>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-muted-on-ink-2">{month}</span>
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep">
          {formatEventWhen(event.starts_at, event.ends_at)}
        </p>
        <h3 className="mt-1.5 font-extrabold leading-tight tracking-tight group-hover:text-brand-accent-deep">
          {event.title}
        </h3>
        {event.location_name && <p className="mt-1 text-sm text-muted">{event.location_name}</p>}
        {event.summary && <p className="mt-2 line-clamp-2 text-sm text-muted">{event.summary}</p>}
        <span
          className={
            "mt-4 inline-flex w-fit border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] " +
            c.className
          }
        >
          {c.label}
        </span>
      </div>
    </Link>
  );
}
