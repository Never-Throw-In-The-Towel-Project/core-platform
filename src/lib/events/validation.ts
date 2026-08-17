// Shared event-field constraints + client-side validation. This mirrors the
// server-side zod schema in src/lib/actions/events.ts, which stays the real
// authority (a Server Action is reachable independently of how its form
// renders). It exists so the authoring form can surface a per-field message the
// instant a field is wrong -- and repopulate + highlight rather than the old
// behaviour where any error wiped the whole form.
//
// Error keys deliberately match the SERVER field names (startsAt/endsAt/...), so
// a client-caught error and a server-returned fieldError share one map shape and
// merge without translation.

export const EVENT_LIMITS = {
  title: 200,
  summary: 300,
  description: 5000,
  locationName: 200,
  locationUrl: 500,
  imageUrl: 500,
  capacityMax: 100000,
} as const;

/** The raw values the form holds (datetimes are the admin's local wall-clock). */
export type EventFieldValues = {
  title: string;
  summary: string;
  description: string;
  startsLocal: string;
  endsLocal: string;
  locationName: string;
  locationUrl: string;
  imageUrl: string;
  capacity: string;
};

export type EventFieldKey =
  | "title"
  | "summary"
  | "description"
  | "startsAt"
  | "endsAt"
  | "locationName"
  | "locationUrl"
  | "imageUrl"
  | "capacity";

export type EventFieldErrors = Partial<Record<EventFieldKey, string>>;

/** Lax URL check -- parity with the server's z.string().url(): parseable as a URL. */
function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate the form's current values. Returns a map of field -> message for
 * every invalid field (empty object when the form is ready to submit). Field
 * order here matches the visual order so "focus the first error" lands on the
 * topmost problem.
 */
export function validateEventFields(v: EventFieldValues): EventFieldErrors {
  const errors: EventFieldErrors = {};

  const title = v.title.trim();
  if (!title) errors.title = "Give the event a title.";
  else if (title.length > EVENT_LIMITS.title) errors.title = `Keep the title under ${EVENT_LIMITS.title} characters.`;

  if (v.summary.trim().length > EVENT_LIMITS.summary)
    errors.summary = `Keep the summary under ${EVENT_LIMITS.summary} characters.`;

  if (v.description.trim().length > EVENT_LIMITS.description)
    errors.description = `Keep the description under ${EVENT_LIMITS.description} characters.`;

  const start = v.startsLocal ? new Date(v.startsLocal) : null;
  if (!v.startsLocal || !start || Number.isNaN(start.getTime())) {
    errors.startsAt = "Add a valid start date and time.";
  }

  if (v.endsLocal) {
    const end = new Date(v.endsLocal);
    if (Number.isNaN(end.getTime())) {
      errors.endsAt = "Add a valid end date and time, or leave it blank.";
    } else if (start && !Number.isNaN(start.getTime()) && end < start) {
      errors.endsAt = "The end time can’t be before the start time.";
    }
  }

  if (v.locationName.trim().length > EVENT_LIMITS.locationName)
    errors.locationName = `Keep the location under ${EVENT_LIMITS.locationName} characters.`;

  const locationUrl = v.locationUrl.trim();
  if (locationUrl && !isValidUrl(locationUrl))
    errors.locationUrl = "The location link needs to be a valid URL (including https://).";

  const imageUrl = v.imageUrl.trim();
  if (imageUrl && !isValidUrl(imageUrl))
    errors.imageUrl = "The image link needs to be a valid URL (including https://).";

  const capacity = v.capacity.trim();
  if (capacity) {
    const n = Number(capacity);
    if (!Number.isInteger(n) || n < 1 || n > EVENT_LIMITS.capacityMax) {
      errors.capacity = `Capacity must be a whole number between 1 and ${EVENT_LIMITS.capacityMax.toLocaleString()}.`;
    }
  }

  return errors;
}

/** The first invalid field in visual order -- used to move focus on submit. */
export function firstErrorField(errors: EventFieldErrors): EventFieldKey | null {
  const order: EventFieldKey[] = [
    "title",
    "summary",
    "startsAt",
    "endsAt",
    "locationName",
    "capacity",
    "locationUrl",
    "imageUrl",
    "description",
  ];
  return order.find((k) => errors[k]) ?? null;
}
