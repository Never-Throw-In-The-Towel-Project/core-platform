import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  EventRow,
  EventBooking,
  EventWithBooking,
  EventBookingStatus,
  EventBookingWithIdentity,
} from "@/types/database";

// Same convention as lib/challenges/queries.ts and lib/content/queries.ts: the
// caller passes whichever client it already holds. The PUBLIC marketing surface
// passes an ANON client (RLS returns only published GLOBAL events); the members'
// surface passes the SSR session client (RLS adds their own company's events);
// the admin surface passes the SSR session client of an ntitt_admin (RLS adds
// drafts + every company). All events columns are public-safe, so select("*").
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any>;

function nowIso(): string {
  return new Date().toISOString();
}

// ---- PUBLIC (anon) surface -------------------------------------------------

/**
 * Upcoming, published, non-cancelled events for the logged-out marketing site.
 * Pass the anon client: RLS returns only GLOBAL (company_id null) events to the
 * anon role, so company-scoped events never appear publicly, on any host.
 */
export async function listPublicUpcomingEvents(anon: AnyClient): Promise<EventRow[]> {
  const { data } = await anon
    .from("events")
    .select("*")
    // Explicit `company_id is null`, not RLS alone: this query is also run for a
    // signed-in-but-not-onboarded user (treated as a visitor), whose authenticated
    // client would otherwise let RLS return their own company's events onto the
    // public surface. The public list is GLOBAL events only, on any client.
    .is("company_id", null)
    .eq("is_published", true)
    .is("cancelled_at", null)
    .gte("starts_at", nowIso())
    .order("starts_at", { ascending: true });
  return (data as EventRow[] | null) ?? [];
}

/** A single public event by slug (published GLOBAL only -- see listPublic note). */
export async function getPublicEventBySlug(anon: AnyClient, slug: string): Promise<EventRow | null> {
  const { data } = await anon
    .from("events")
    .select("*")
    .eq("slug", slug)
    .is("company_id", null)
    .eq("is_published", true)
    .maybeSingle();
  return (data as EventRow | null) ?? null;
}

// ---- MEMBER surface --------------------------------------------------------

/**
 * Upcoming published events visible to this member (global + their own company,
 * via RLS), each decorated with the member's own booking status. A member's
 * bookings are readable only by them ("members read own bookings"), so the
 * bookings read returns just their rows; a cancelled booking decorates as null
 * (i.e. "not booked").
 */
export async function listUpcomingEventsForMember(supabase: AnyClient): Promise<EventWithBooking[]> {
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("is_published", true)
    .is("cancelled_at", null)
    .gte("starts_at", nowIso())
    .order("starts_at", { ascending: true });
  const rows = (events as EventRow[] | null) ?? [];
  if (rows.length === 0) return [];

  const { data: bookings } = await supabase
    .from("event_bookings")
    .select("event_id, status")
    .in("event_id", rows.map((e) => e.id))
    .neq("status", "cancelled");

  const statusByEvent = new Map<string, EventBookingStatus>();
  for (const b of bookings ?? []) {
    const row = b as { event_id: string; status: EventBookingStatus };
    statusByEvent.set(row.event_id, row.status);
  }
  return rows.map((e) => ({ ...e, my_booking_status: statusByEvent.get(e.id) ?? null }));
}

/** A single event by slug for a member (RLS: global + own-company published), with their booking status. */
export async function getEventBySlugForMember(
  supabase: AnyClient,
  slug: string,
  userId: string
): Promise<EventWithBooking | null> {
  const { data } = await supabase.from("events").select("*").eq("slug", slug).maybeSingle();
  const event = (data as EventRow | null) ?? null;
  if (!event) return null;

  const { data: booking } = await supabase
    .from("event_bookings")
    .select("status")
    .eq("event_id", event.id)
    .eq("user_id", userId)
    .neq("status", "cancelled")
    .maybeSingle();
  return { ...event, my_booking_status: (booking as { status: EventBookingStatus } | null)?.status ?? null };
}

// ---- ADMIN (ntitt_admin) surface -------------------------------------------

/** Every event including drafts + cancelled, soonest-first. Call only after requireNtittAdmin(). */
export async function listAllEventsForAdmin(supabase: AnyClient): Promise<EventRow[]> {
  const { data } = await supabase.from("events").select("*").order("starts_at", { ascending: false });
  return (data as EventRow[] | null) ?? [];
}

/** A single event for the admin editor (any state). RLS: ntitt_admin sees all;
 *  hr_admin sees their own company's. */
export async function getEventForAdmin(supabase: AnyClient, id: string): Promise<EventRow | null> {
  const { data } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  return (data as EventRow | null) ?? null;
}

/** One company's own events (all states), soonest-first, for the HR Workspace.
 *  RLS lets an hr_admin read their own company's events incl. drafts. */
export async function listCompanyEvents(supabase: AnyClient, companyId: string): Promise<EventRow[]> {
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("company_id", companyId)
    .order("starts_at", { ascending: false });
  return (data as EventRow[] | null) ?? [];
}

/**
 * The attendee + waitlist roster for one event, oldest booking first. ntitt_admin
 * reads all bookings ("ntitt admins read all bookings"). Guest bookings carry
 * their own name; member names are resolved via the service-role client (profiles
 * is own-row-read only under RLS), selecting ONLY id + display_name -- the same
 * narrowly-scoped, server-side pattern lib/community/queries.ts uses to render
 * post authors. Call only after requireNtittAdmin().
 */
export async function listBookingsForEvent(
  supabase: AnyClient,
  eventId: string
): Promise<EventBookingWithIdentity[]> {
  const { data } = await supabase
    .from("event_bookings")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  const bookings = (data as EventBooking[] | null) ?? [];
  if (bookings.length === 0) return [];

  const memberIds = Array.from(
    new Set(bookings.filter((b) => b.user_id).map((b) => b.user_id as string))
  );
  const nameById = new Map<string, string>();
  if (memberIds.length > 0) {
    const admin = createAdminClient();
    const { data: profs } = await admin.from("profiles").select("id, display_name").in("id", memberIds);
    for (const p of profs ?? []) {
      const row = p as { id: string; display_name: string };
      nameById.set(row.id, row.display_name);
    }
  }

  return bookings.map((b) => ({
    ...b,
    member: b.user_id ? { display_name: nameById.get(b.user_id) ?? "Member" } : null,
  }));
}
