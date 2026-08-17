// Shared event date/time formatting. Used on all three surfaces (admin, member,
// public). Display formatting pins the timezone to Europe/London so the string
// is identical on the server (UTC) and the client -> no hydration mismatch, and
// correct for the UK audience regardless of a viewer's own timezone.

const TZ = "Europe/London";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TZ,
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: TZ,
});

/** "Sat 5 Sep 2026 · 6:00 pm", or a range when the event has an end time. */
export function formatEventWhen(startsAt: string, endsAt?: string | null): string {
  const start = new Date(startsAt);
  const startDate = dateFmt.format(start);
  const startTime = timeFmt.format(start);
  if (endsAt) {
    const end = new Date(endsAt);
    const endDate = dateFmt.format(end);
    const endTime = timeFmt.format(end);
    if (endDate === startDate) return `${startDate} · ${startTime} – ${endTime}`;
    return `${startDate}, ${startTime} → ${endDate}, ${endTime}`;
  }
  return `${startDate} · ${startTime}`;
}

/** Short "Sat 5 Sep" for compact cards. */
export function formatEventDateShort(startsAt: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: TZ,
  }).format(new Date(startsAt));
}

const weekdayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: TZ });
const dayNumFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: TZ });
const monthShortFmt = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: TZ });

/** Stacked parts ("Sat" / "5" / "Sep") for a date block on a list card. */
export function eventDateParts(startsAt: string): { weekday: string; day: string; month: string } {
  const d = new Date(startsAt);
  return { weekday: weekdayFmt.format(d), day: dayNumFmt.format(d), month: monthShortFmt.format(d) };
}

/** Just the time(s) — "6:00 pm" or "6:00 pm – 8:00 pm" when the end is same-day.
 *  The date is assumed shown elsewhere (e.g. a date block), so it's omitted. */
export function formatEventTimeRange(startsAt: string, endsAt?: string | null): string {
  const start = timeFmt.format(new Date(startsAt));
  if (endsAt) {
    const sameDay = dateFmt.format(new Date(startsAt)) === dateFmt.format(new Date(endsAt));
    if (sameDay) return `${start} – ${timeFmt.format(new Date(endsAt))}`;
  }
  return start;
}

/**
 * Format a stored UTC ISO instant into a `datetime-local` input value
 * ("YYYY-MM-DDTHH:mm") in the BROWSER's local timezone. Client-only: call it in
 * an effect (not during SSR) so the value reflects the admin's own clock and the
 * local -> ISO round-trip on submit stays consistent.
 */
export function isoToBrowserLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Client-only datetime helpers for the authoring form. All operate on the
 * `datetime-local` wall-clock string ("YYYY-MM-DDTHH:mm") in the browser's own
 * timezone. Call them from effects/handlers, never during SSR (they read the
 * machine clock / local offset).
 */

/** The `datetime-local` value for the next top-of-hour, a friendly default start. */
export function nextHourLocalInput(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return isoToBrowserLocalInput(d.toISOString());
}

/** Add minutes to a wall-clock string, returning the same `datetime-local` format. */
export function addMinutesToLocalInput(local: string, minutes: number): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return local;
  d.setMinutes(d.getMinutes() + minutes);
  return isoToBrowserLocalInput(d.toISOString());
}

/** Convert a `datetime-local` wall-clock string to a UTC ISO instant (null if empty/invalid). */
export function localInputToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
