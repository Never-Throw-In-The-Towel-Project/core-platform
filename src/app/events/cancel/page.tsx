import Link from "next/link";
import { verifyBookingToken } from "@/lib/events/guestToken";
import { loadGuestBookingContext } from "@/lib/events/guestBookingContext";
import { cancelGuestBooking } from "@/lib/actions/events";

// A SAFE landing page (see /events/confirm): rendering it (GET) does nothing.
// The booking is only cancelled when a human submits the form below, so an email
// link-scanner auto-fetching the cancel link can't drop the guest's booking.
export const dynamic = "force-dynamic";

const LINK = "text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-deep hover:underline";

export default async function CancelGuestBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string; token?: string }>;
}) {
  const { booking = "", token = "" } = await searchParams;
  const valid = Boolean(booking) && Boolean(token) && (await verifyBookingToken(booking, token));
  const ctx = valid ? await loadGuestBookingContext(booking) : null;

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <Link href="/events" className={LINK}>
        ← All events
      </Link>

      {!valid || !ctx ? (
        <>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight">This link didn’t work</h1>
          <p className="mt-3 text-sm text-muted">It may have already been used. There’s nothing you need to do.</p>
        </>
      ) : (
        <>
          <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-deep">
            {ctx.when}
          </p>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight">Cancel your booking?</h1>
          <p className="mt-4 text-sm text-muted">
            You’re about to cancel your place for <strong className="text-foreground">{ctx.title}</strong>. If anyone
            is waiting, your spot goes to the next person in line.
          </p>

          <form action={cancelGuestBooking} className="mt-6">
            <input type="hidden" name="booking" value={booking} />
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="inline-flex border border-brand-accent-deep px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-brand-accent-deep transition-colors hover:bg-brand-accent-deep hover:text-brand-accent-foreground"
            >
              Yes, cancel my booking
            </button>
          </form>

          <p className="mt-5 text-sm text-muted">
            Changed your mind?{" "}
            <Link
              href={`/events/confirm?booking=${encodeURIComponent(booking)}&token=${encodeURIComponent(token)}`}
              className="font-semibold underline underline-offset-2 hover:text-foreground"
            >
              Keep my spot
            </Link>
            .
          </p>
        </>
      )}
    </main>
  );
}
