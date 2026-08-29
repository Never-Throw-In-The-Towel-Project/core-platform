// Pure (no DB, no "server-only") so it's unit-testable -- the actual push send
// lives in the server-only notify.ts. Decides whether a just-saved event edit is
// worth pinging booked attendees about: only a change to the TIME or the PLACE
// counts, so fixing a typo in the description (or swapping the hero image) never
// notifies anyone.

export type EventSnapshot = {
  starts_at: string;
  ends_at: string | null;
  location_name: string | null;
  location_url: string | null;
};

export type EventChangeNotice = { title: string; body: string };

/** The attendee notice for an edit, or null when neither the time nor the place
 *  moved. `null`/empty location fields are treated as equal, so clearing an
 *  already-empty field isn't a "change". */
export function eventChangeNotice(
  eventTitle: string,
  before: EventSnapshot,
  after: EventSnapshot
): EventChangeNotice | null {
  const timeChanged =
    before.starts_at !== after.starts_at || (before.ends_at ?? null) !== (after.ends_at ?? null);
  const locationChanged =
    (before.location_name ?? "") !== (after.location_name ?? "") ||
    (before.location_url ?? "") !== (after.location_url ?? "");

  if (!timeChanged && !locationChanged) return null;

  const what = timeChanged && locationChanged ? "time and location" : timeChanged ? "time" : "location";
  return {
    title: "Event updated",
    body: `The ${what} for “${eventTitle}” has changed — tap to see the details.`,
  };
}
