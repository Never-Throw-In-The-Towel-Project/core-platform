"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { signBookingToken } from "@/lib/events/guestToken";
import { sendGuestBookingConfirmEmail } from "@/lib/events/guestEmail";
import { formatEventWhen } from "@/lib/events/format";
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

/**
 * Update / publish / cancel / delete are open to BOTH authors: an ntitt_admin
 * (global events) and an hr_admin (their own company's). The events RLS policies
 * are the real scope boundary -- an hr_admin's UPDATE/DELETE only ever match rows
 * whose company_id is their own -- so this is just the friendly access check.
 */
async function ensureEventEditor(): Promise<RoutineActionState | null> {
  const profile = await getProfile();
  if (profile.role !== "ntitt_admin" && profile.role !== "hr_admin") {
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

async function uniqueEventSlug(title: string, excludeId?: string): Promise<string> {
  const base = slugifyBase(title);
  // Slugs are globally unique, so the scan must see EVERY event -- including
  // global drafts and other companies' events an hr_admin author can't read
  // under RLS. Use the service-role client for this slug-only read (no PII), so
  // a company author can't accidentally collide with a slug they can't see.
  const admin = createAdminClient();
  const { data } = await admin.from("events").select("id, slug").ilike("slug", `${base}%`);
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
    const slug = await uniqueEventSlug(d.title);
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
  const denied = await ensureEventEditor();
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
    const slug = await uniqueEventSlug(d.title, eventId);
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
  revalidatePath("/workspace/events");
  revalidatePath(`/workspace/events/${eventId}`);
  revalidatePath("/events");
  return { status: "success", message: "Event updated." };
}

export async function setEventPublished(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await verifySession();
  const denied = await ensureEventEditor();
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
  revalidatePath("/workspace/events");
  revalidatePath(`/workspace/events/${parsed.data.eventId}`);
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
  const denied = await ensureEventEditor();
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
  revalidatePath("/workspace/events");
  revalidatePath(`/workspace/events/${parsed.data.eventId}`);
  revalidatePath("/events");
  return { status: "success" };
}

/** Permanently delete an event (and its bookings, via ON DELETE CASCADE). */
export async function deleteEvent(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await verifySession();
  const denied = await ensureEventEditor();
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
  revalidatePath("/workspace/events");
  revalidatePath("/events");
  return { status: "success", message: "Event deleted." };
}

// ============================================================================
// HR-admin (company) event authoring. Same fields as the ntitt create, but the
// event is scoped to the admin's OWN company (company_id = their profile). The
// events INSERT RLS policy is the real gate (verified live by the harness);
// this sets company_id and checks the role for a friendly message.
// ============================================================================

export async function createCompanyEvent(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();
  const profile = await getProfile();
  if (profile.role !== "hr_admin") {
    return { status: "error", message: "You don’t have access to company events." };
  }

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
    const slug = await uniqueEventSlug(d.title);
    const { error } = await supabase.from("events").insert({
      company_id: profile.company_id,
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

  revalidatePath("/workspace/events");
  revalidatePath("/events");
  return { status: "success", message: "Event created." };
}

// ============================================================================
// GUEST booking (Phase 2). A logged-out visitor books a published GLOBAL event
// with just a name + email. DOUBLE OPT-IN: this creates a 'pending' row (holds
// no seat) and emails a tokenised confirm link; the seat is only claimed when
// they click it (confirm_guest_booking, via /api/events/confirm). Written with
// the service-role client because there is no anon INSERT policy on bookings.
// ============================================================================

const GuestBookingSchema = z.object({
  eventId: uuid,
  name: z.string().trim().min(1, "Add your name.").max(100),
  email: z.string().trim().email("Enter a valid email address.").max(200),
});

export async function requestGuestBooking(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const parsed = GuestBookingSchema.safeParse({
    eventId: formData.get("eventId"),
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your name and email." };
  }
  const { eventId, name } = parsed.data;
  const email = parsed.data.email.toLowerCase();
  const slug = typeof formData.get("slug") === "string" ? String(formData.get("slug")) : null;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    return { status: "error", message: "Guest booking isn’t available right now — please sign in to book." };
  }

  try {
    const admin = createAdminClient();

    // Guest booking is for published, non-cancelled, upcoming GLOBAL events only.
    const { data: ev } = await admin
      .from("events")
      .select("id, title, slug, starts_at, ends_at, is_published, cancelled_at, company_id")
      .eq("id", eventId)
      .maybeSingle();
    if (!ev || !ev.is_published || ev.company_id !== null || ev.cancelled_at) {
      return { status: "error", message: "This event isn’t open for guest booking." };
    }
    if (new Date(ev.starts_at as string) < new Date()) {
      return { status: "error", message: "This event has already taken place." };
    }

    // Floodgate against email-bombing via this one event: cap freshly-created
    // pending bookings in a short window. (Per-email is already deduped below.)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recentPending } = await admin
      .from("event_bookings")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "pending")
      .gte("created_at", tenMinutesAgo);
    if ((recentPending ?? 0) > 30) {
      return { status: "error", message: "Lots of booking requests just now — please try again shortly." };
    }

    // One active booking per (event, email): reuse a pending one (resend the
    // link), or tell them they're already in.
    const { data: existing } = await admin
      .from("event_bookings")
      .select("id, status, guest_name")
      .eq("event_id", eventId)
      .eq("guest_email", email)
      .neq("status", "cancelled")
      .maybeSingle();

    let bookingId: string;
    let guestName: string;
    const newlyInserted = !existing;
    if (existing) {
      if (existing.status === "confirmed" || existing.status === "waitlisted") {
        return { status: "success", message: "You’re already booked onto this one — check your email for the details." };
      }
      bookingId = existing.id as string;
      guestName = (existing.guest_name as string | null) ?? name;
    } else {
      const { data: inserted, error } = await admin
        .from("event_bookings")
        .insert({ event_id: eventId, guest_name: name, guest_email: email, status: "pending" })
        .select("id")
        .single();
      if (error || !inserted) return { status: "error", message: "Couldn’t start your booking. Please try again." };
      bookingId = inserted.id as string;
      guestName = name;
    }

    const token = await signBookingToken(bookingId);
    if (!token) {
      if (newlyInserted) await admin.from("event_bookings").delete().eq("id", bookingId).eq("status", "pending");
      return { status: "error", message: "Guest booking isn’t available right now — please sign in to book." };
    }
    const confirmUrl = new URL("/api/events/confirm", siteUrl);
    confirmUrl.searchParams.set("booking", bookingId);
    confirmUrl.searchParams.set("token", token);
    const cancelUrl = new URL("/api/events/cancel", siteUrl);
    cancelUrl.searchParams.set("booking", bookingId);
    cancelUrl.searchParams.set("token", token);

    const sent = await sendGuestBookingConfirmEmail({
      toEmail: parsed.data.email,
      guestName,
      eventTitle: ev.title as string,
      eventWhen: formatEventWhen(ev.starts_at as string, ev.ends_at as string | null),
      confirmUrl: confirmUrl.toString(),
      cancelUrl: cancelUrl.toString(),
    });
    if (!sent.ok) {
      // Don't leave an orphan pending row if the email never went out.
      if (newlyInserted) await admin.from("event_bookings").delete().eq("id", bookingId).eq("status", "pending");
      return { status: "error", message: "We couldn’t send the confirmation email — please sign in to book instead." };
    }
  } catch {
    return { status: "error", message: "Couldn’t start your booking. Please try again." };
  }

  if (slug) revalidatePath(`/events/${slug}`);
  return { status: "success", message: "Almost there — check your email to confirm your spot." };
}
