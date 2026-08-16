"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { type RoutineActionState } from "./routineState";

const uuid = z.string().uuid();

// ============================================================================
// MEMBER booking actions. Every write goes through the SECURITY DEFINER
// functions book_event() / cancel_my_booking() -- there is no member INSERT/
// UPDATE policy on event_bookings, so capacity + waitlist can't be bypassed by a
// direct write. The functions key off auth.uid(); the client's role check here
// is only for a friendly message.
// ============================================================================

/** Book (or re-book) the caller onto an event. Returns confirmed/waitlisted state in the message. */
export async function bookEvent(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await verifySession();
  const parsed = uuid.safeParse(formData.get("eventId"));
  if (!parsed.success) return { status: "error", message: "That event could not be found." };
  const eventId = parsed.data;
  const slug = typeof formData.get("slug") === "string" ? String(formData.get("slug")) : null;

  let bookedStatus: string;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("book_event", { p_event_id: eventId });
    if (error) {
      // book_event raises "event not bookable" / "event not found" for a draft,
      // cancelled, or wrong-company event -- all surface as the same friendly line.
      return { status: "error", message: "You can’t book onto this event right now. It may be full or no longer available." };
    }
    bookedStatus = String(data);
  } catch {
    return { status: "error", message: "Couldn’t book you in just now. Please try again." };
  }

  revalidatePath("/events");
  if (slug) revalidatePath(`/events/${slug}`);
  return {
    status: "success",
    message:
      bookedStatus === "waitlisted"
        ? "You’re on the waitlist — we’ll move you up the moment a spot frees."
        : "You’re booked in. See you there.",
  };
}

/** Cancel the caller's booking. Frees a seat and auto-promotes the next waitlister. */
export async function cancelBooking(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await verifySession();
  const parsed = uuid.safeParse(formData.get("eventId"));
  if (!parsed.success) return { status: "error", message: "That event could not be found." };
  const eventId = parsed.data;
  const slug = typeof formData.get("slug") === "string" ? String(formData.get("slug")) : null;

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_my_booking", { p_event_id: eventId });
    if (error) return { status: "error", message: "Couldn’t cancel just now. Please try again." };
  } catch {
    return { status: "error", message: "Couldn’t cancel just now. Please try again." };
  }

  revalidatePath("/events");
  if (slug) revalidatePath(`/events/${slug}`);
  return { status: "success", message: "Your booking’s cancelled." };
}

// ============================================================================
// ADMIN (ntitt_admin) authoring actions. Same defence-in-depth as
// lib/actions/challenges.ts: the role is checked here for a message; the events
// INSERT/UPDATE/DELETE RLS policies are the real boundary (verified live by the
// migration harness). Phase 1 authors GLOBAL events only (company_id null).
// ============================================================================

async function ensureNtittAdmin(): Promise<RoutineActionState | null> {
  const profile = await getProfile();
  if (profile.role !== "ntitt_admin") {
    return { status: "error", message: "You don’t have access to events." };
  }
  return null;
}

/** Slugify a title, then make it unique against existing events by suffixing -2, -3, … */
function slugifyBase(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "event";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function uniqueEventSlug(supabase: any, title: string, excludeId?: string): Promise<string> {
  const base = slugifyBase(title);
  // Pull existing slugs that share the base, then pick the first free variant.
  const { data } = await supabase.from("events").select("id, slug").ilike("slug", `${base}%`);
  const taken = new Set(
    ((data as { id: string; slug: string }[] | null) ?? [])
      .filter((r) => r.id !== excludeId)
      .map((r) => r.slug)
  );
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

const EventFields = z.object({
  title: z.string().trim().min(1, "Give the event a title.").max(200),
  summary: z.string().trim().max(300).optional(),
  description: z.string().trim().max(5000).optional(),
  startsAt: z.coerce.date({ message: "Add a valid start date and time." }),
  endsAt: z.coerce.date().optional(),
  locationName: z.string().trim().max(200).optional(),
  locationUrl: z.string().trim().url("The location link needs to be a valid URL.").max(500).optional(),
  imageUrl: z.string().trim().url("The image link needs to be a valid URL.").max(500).optional(),
  capacity: z.number().int().min(1).max(100000).optional(),
  publish: z.enum(["true", "false"]).optional(),
});

function readEventForm(formData: FormData) {
  const rawCapacity = formData.get("capacity");
  const rawEnds = formData.get("endsAt");
  return EventFields.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary") || undefined,
    description: formData.get("description") || undefined,
    startsAt: formData.get("startsAt"),
    endsAt: rawEnds && rawEnds !== "" ? rawEnds : undefined,
    locationName: formData.get("locationName") || undefined,
    locationUrl: formData.get("locationUrl") || undefined,
    imageUrl: formData.get("imageUrl") || undefined,
    capacity: rawCapacity && rawCapacity !== "" ? Number(rawCapacity) : undefined,
    publish: formData.get("publish") || undefined,
  });
}

export async function createEvent(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();
  const denied = await ensureNtittAdmin();
  if (denied) return denied;

  const parsed = readEventForm(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the fields and try again." };
  }
  const d = parsed.data;
  if (d.endsAt && d.endsAt < d.startsAt) {
    return { status: "error", message: "The end time can’t be before the start time." };
  }

  try {
    const supabase = await createClient();
    const slug = await uniqueEventSlug(supabase, d.title);
    const { error } = await supabase.from("events").insert({
      company_id: null,
      title: d.title,
      slug,
      summary: d.summary ?? null,
      description: d.description ?? null,
      starts_at: d.startsAt.toISOString(),
      ends_at: d.endsAt ? d.endsAt.toISOString() : null,
      location_name: d.locationName ?? null,
      location_url: d.locationUrl ?? null,
      image_url: d.imageUrl ?? null,
      capacity: d.capacity ?? null,
      is_published: d.publish === "true",
      created_by: session.userId,
    });
    if (error) return { status: "error", message: "Something went wrong saving this event. Please try again." };
  } catch {
    return { status: "error", message: "Something went wrong saving this event. Please try again." };
  }

  revalidatePath("/admin/events");
  revalidatePath("/events");
  return { status: "success", message: "Event created." };
}

export async function updateEvent(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await verifySession();
  const denied = await ensureNtittAdmin();
  if (denied) return denied;

  const idParsed = uuid.safeParse(formData.get("eventId"));
  if (!idParsed.success) return { status: "error", message: "That event could not be found." };
  const eventId = idParsed.data;

  const parsed = readEventForm(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the fields and try again." };
  }
  const d = parsed.data;
  if (d.endsAt && d.endsAt < d.startsAt) {
    return { status: "error", message: "The end time can’t be before the start time." };
  }

  try {
    const supabase = await createClient();
    const slug = await uniqueEventSlug(supabase, d.title, eventId);
    const { error } = await supabase
      .from("events")
      .update({
        title: d.title,
        slug,
        summary: d.summary ?? null,
        description: d.description ?? null,
        starts_at: d.startsAt.toISOString(),
        ends_at: d.endsAt ? d.endsAt.toISOString() : null,
        location_name: d.locationName ?? null,
        location_url: d.locationUrl ?? null,
        image_url: d.imageUrl ?? null,
        capacity: d.capacity ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId);
    if (error) return { status: "error", message: "Couldn’t save your changes. Please try again." };
  } catch {
    return { status: "error", message: "Couldn’t save your changes. Please try again." };
  }

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/events");
  return { status: "success", message: "Event updated." };
}

export async function setEventPublished(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await verifySession();
  const denied = await ensureNtittAdmin();
  if (denied) return denied;

  const parsed = z
    .object({ eventId: uuid, publish: z.enum(["true", "false"]) })
    .safeParse({ eventId: formData.get("eventId"), publish: formData.get("publish") });
  if (!parsed.success) return { status: "error", message: "Something went wrong. Please try again." };

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("events")
      .update({ is_published: parsed.data.publish === "true", updated_at: new Date().toISOString() })
      .eq("id", parsed.data.eventId);
    if (error) return { status: "error", message: "Couldn’t update that. Please try again." };
  } catch {
    return { status: "error", message: "Couldn’t update that. Please try again." };
  }

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${parsed.data.eventId}`);
  revalidatePath("/events");
  return { status: "success" };
}

/** Call an event off (or reinstate it). A cancelled event stays visible with a
 *  "cancelled" state so booked members/visitors see it; bookings are untouched. */
export async function setEventCancelled(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await verifySession();
  const denied = await ensureNtittAdmin();
  if (denied) return denied;

  const parsed = z
    .object({ eventId: uuid, cancel: z.enum(["true", "false"]) })
    .safeParse({ eventId: formData.get("eventId"), cancel: formData.get("cancel") });
  if (!parsed.success) return { status: "error", message: "Something went wrong. Please try again." };

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("events")
      .update({
        cancelled_at: parsed.data.cancel === "true" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.eventId);
    if (error) return { status: "error", message: "Couldn’t update that. Please try again." };
  } catch {
    return { status: "error", message: "Couldn’t update that. Please try again." };
  }

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${parsed.data.eventId}`);
  revalidatePath("/events");
  return { status: "success" };
}

/** Permanently delete an event (and its bookings, via ON DELETE CASCADE). */
export async function deleteEvent(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await verifySession();
  const denied = await ensureNtittAdmin();
  if (denied) return denied;

  const parsed = uuid.safeParse(formData.get("eventId"));
  if (!parsed.success) return { status: "error", message: "That event could not be found." };

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("events").delete().eq("id", parsed.data);
    if (error) return { status: "error", message: "Couldn’t delete that event. Please try again." };
  } catch {
    return { status: "error", message: "Couldn’t delete that event. Please try again." };
  }

  revalidatePath("/admin/events");
  revalidatePath("/events");
  return { status: "success", message: "Event deleted." };
}
