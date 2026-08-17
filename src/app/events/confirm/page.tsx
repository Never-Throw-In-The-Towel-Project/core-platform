import Link from "next/link";
import { verifyBookingToken } from "@/lib/events/guestToken";
import { loadGuestBookingContext } from "@/lib/events/guestBookingContext";
import { confirmGuestBooking } from "@/lib/actions/events";

// A SAFE landing page: rendering it (GET) does nothing. The booking is only
// confirmed when a human submits the form below (a server-action POST) -- so
// email link-scanners / prefetchers that auto-fetch the link can't confirm (or,
// via the cancel page, cancel) a booking on the guest's behalf. force-dynamic
// because the token is read per-request and must never be cached.
export const dynamic = "force-dynamic";

const LINK = "text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-deep hover:underline";

export default async function ConfirmGuestBookingPage({
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
          <p className="mt-3 text-sm text-muted">
            It may have already been used. Head back to the event and book again — it only takes a moment.
          </p>
        </>
      ) : (
        <>
          <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-deep">
            {ctx.when}
          </p>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight">{ctx.title}</h1>
          <p className="mt-4 text-sm text-muted">
            Tap below to confirm your spot. If the event is already full you’ll join the waitlist, and we’ll move
            you up the moment a place frees.
          </p>

          <form action={confirmGuestBooking} className="mt-6">
            <input type="hidden" name="booking" value={booking} />
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="inline-flex bg-brand-accent px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground transition-opacity hover:opacity-90"
            >
              Confirm my spot
            </button>
          </form>

          <p className="mt-5 text-sm text-muted">
            Didn’t request this?{" "}
            <Link
              href={`/events/cancel?booking=${encodeURIComponent(booking)}&token=${encodeURIComponent(token)}`}
              className="font-semibold underline underline-offset-2 hover:text-foreground"
            >
              Cancel instead
            </Link>
            .
          </p>
        </>
      )}
    </main>
  );
}
