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
