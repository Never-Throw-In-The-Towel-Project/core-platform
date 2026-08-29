"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { signBookingToken, verifyBookingToken } from "@/lib/events/guestToken";
import { sendGuestBookingConfirmEmail } from "@/lib/events/guestEmail";
import { formatEventWhen } from "@/lib/events/format";
import { type RoutineActionState } from "./routineState";
import { type EventFormState } from "./eventFormState";
import { type EventFieldErrors } from "@/lib/events/validation";
import {
  createEventImageUploadTarget,
  deleteEventImageByUrl,
  deleteEventImageByPath,
  eventImageUrlFromPath,
  isEventImagePath,
} from "@/lib/events/imageUpload";

const uuid = z.string().uuid();

/** Flatten a zod parse error into our per-field { field: firstMessage } map. */
function zodToFieldErrors(error: z.ZodError): EventFieldErrors {
  const flat = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  const out: EventFieldErrors = {};
  for (const [key, messages] of Object.entries(flat)) {
    const first = messages?.[0];
    if (first) (out as Record<string, string>)[key] = first;
  }
  return out;
}

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
    capacity: rawCapacity && rawCapacity !== "" ? Number(rawCapacity) : undefined,
    publish: formData.get("publish") || undefined,
  });
}

/**
 * The public URL for an image the form is submitting, or null if it submitted
 * none. The browser uploads the (downscaled) file direct to Storage and sends us
 * only its object PATH (see createEventImageUpload); here we validate that path
 * is our own shape and in the caller's own folder, then derive the public URL
 * stored in events.image_url. A missing/invalid path is simply "no image" -- the
 * image can no longer fail the save, so there is no error branch to abort on.
 */
function submittedEventImageUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  formData: FormData
): string | null {
  const raw = formData.get("imagePath");
  if (typeof raw !== "string" || raw === "" || !isEventImagePath(userId, raw)) return null;
  return eventImageUrlFromPath(supabase, raw);
}

/**
 * Mint a signed upload URL for an event image so the browser can PUT it straight
 * to Storage (see createEventImageUploadTarget). Both authors -- ntitt_admin
 * (global) and hr_admin (own company) -- may add event images; the event-images
 * INSERT RLS is the real gate, and running as the author's own session scopes
 * the mint to their own folder.
 */
export async function createEventImageUpload(input: {
  contentType: string;
}): Promise<{ path: string; token: string } | { error: string }> {
  const session = await verifySession();
  const denied = await ensureEventEditor();
  if (denied) return { error: "You don’t have access to events." };
  try {
    const supabase = await createClient();
    return await createEventImageUploadTarget(supabase, session.userId, input.contentType);
  } catch {
    return { error: "Couldn’t start the image upload. Please try again." };
  }
}

/**
 * Best-effort delete of a just-uploaded event image that never got saved -- the
 * Studio calls this when an admin replaces or removes a pick (images upload the
 * moment they're chosen, before the row is saved, so a discarded pick would
 * otherwise orphan the object). Only ever deletes within the caller's own folder.
 */
export async function discardEventImageUpload(input: { path: string }): Promise<void> {
  const session = await verifySession();
  const denied = await ensureEventEditor();
  if (denied) return;
  if (!isEventImagePath(session.userId, input.path)) return;
  try {
    const supabase = await createClient();
    await deleteEventImageByPath(supabase, input.path);
  } catch {
    /* non-fatal: an orphan is harmless */
  }
}

export async function createEvent(
  _prev: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const session = await verifySession();
  const denied = await ensureNtittAdmin();
  if (denied) return denied;

  const parsed = readEventForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields and try again.",
      fieldErrors: zodToFieldErrors(parsed.error),
    };
  }
  const d = parsed.data;
  if (d.endsAt && d.endsAt < d.startsAt) {
    return {
      status: "error",
      message: "The end time can’t be before the start time.",
      fieldErrors: { endsAt: "The end time can’t be before the start time." },
    };
  }

  try {
    const supabase = await createClient();
    const imageUrl = submittedEventImageUrl(supabase, session.userId, formData);

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
      image_url: imageUrl,
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
  _prev: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const session = await verifySession();
  const denied = await ensureEventEditor();
  if (denied) return denied;

  const idParsed = uuid.safeParse(formData.get("eventId"));
  if (!idParsed.success) return { status: "error", message: "That event could not be found." };
  const eventId = idParsed.data;

  const parsed = readEventForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields and try again.",
      fieldErrors: zodToFieldErrors(parsed.error),
    };
  }
  const d = parsed.data;
  if (d.endsAt && d.endsAt < d.startsAt) {
    return {
      status: "error",
      message: "The end time can’t be before the start time.",
      fieldErrors: { endsAt: "The end time can’t be before the start time." },
    };
  }

  try {
    const supabase = await createClient();

    // Resolve the image: a new upload replaces it, `removeImage` clears it,
    // otherwise it's left exactly as-is. The existing URL is read first (RLS
    // authorises this same-row read) so a replaced/removed asset can be cleaned
    // up afterwards.
    const { data: existing } = await supabase
      .from("events")
      .select("image_url")
      .eq("id", eventId)
      .maybeSingle();
    const oldImageUrl = (existing as { image_url: string | null } | null)?.image_url ?? null;

    let nextImageUrl: string | null = oldImageUrl;
    const fresh = submittedEventImageUrl(supabase, session.userId, formData);
    if (fresh) nextImageUrl = fresh;
    else if (formData.get("removeImage") === "true") nextImageUrl = null;

    // The slug is deliberately NOT regenerated on edit: it's the public
    // /events/<slug> URL (shared, marketed, bookmarked), so a title tweak must
    // not silently 404 those links. It's set once at create.
    const { data, error } = await supabase
      .from("events")
      .update({
        title: d.title,
        summary: d.summary ?? null,
        description: d.description ?? null,
        starts_at: d.startsAt.toISOString(),
        ends_at: d.endsAt ? d.endsAt.toISOString() : null,
        location_name: d.locationName ?? null,
        location_url: d.locationUrl ?? null,
        image_url: nextImageUrl,
        capacity: d.capacity ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId)
      .select("id");
    if (error) return { status: "error", message: "Couldn’t save your changes. Please try again." };
    // An RLS mismatch (e.g. an hr_admin editing a global/other-company event)
    // returns 0 rows and no error -- report that rather than a false success.
    if (!data || data.length === 0) {
      return { status: "error", message: "You can’t edit this event, or it no longer exists." };
    }

    // The image changed: bin the old uploaded asset (best-effort, service-role
    // so it works whoever uploaded it; a no-op for an external/pasted URL).
    if (nextImageUrl !== oldImageUrl) {
      await deleteEventImageByUrl(createAdminClient(), oldImageUrl);
    }
    // The capacity may have risen: promote waitlisters into any freed seats.
    // Best-effort -- the edit is already saved, so a reconcile hiccup must not
    // surface as a save failure. reconcile_event_capacity is service_role-only,
    // hence the admin client (this edit was already RLS-authorised above).
    try {
      await createAdminClient().rpc("reconcile_event_capacity", { p_event_id: eventId });
    } catch {
      /* non-fatal: the save succeeded */
    }
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
    const { data, error } = await supabase
      .from("events")
      .update({ is_published: parsed.data.publish === "true", updated_at: new Date().toISOString() })
      .eq("id", parsed.data.eventId)
      .select("id");
    if (error) return { status: "error", message: "Couldn’t update that. Please try again." };
    if (!data || data.length === 0) return { status: "error", message: "You can’t change this event." };
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
    const { data, error } = await supabase
      .from("events")
      .update({
        cancelled_at: parsed.data.cancel === "true" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.eventId)
      .select("id");
    if (error) return { status: "error", message: "Couldn’t update that. Please try again." };
    if (!data || data.length === 0) return { status: "error", message: "You can’t change this event." };
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
    const { data, error } = await supabase.from("events").delete().eq("id", parsed.data).select("id, image_url");
    if (error) return { status: "error", message: "Couldn’t delete that event. Please try again." };
    if (!data || data.length === 0) {
      return { status: "error", message: "You can’t delete this event, or it no longer exists." };
    }
    // Bin the uploaded image too (best-effort; a no-op for an external URL).
    await deleteEventImageByUrl(createAdminClient(), (data[0] as { image_url: string | null }).image_url);
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
  _prev: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const session = await verifySession();
  const profile = await getProfile();
  if (profile.role !== "hr_admin") {
    return { status: "error", message: "You don’t have access to company events." };
  }

  const parsed = readEventForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields and try again.",
      fieldErrors: zodToFieldErrors(parsed.error),
    };
  }
  const d = parsed.data;
  if (d.endsAt && d.endsAt < d.startsAt) {
    return {
      status: "error",
      message: "The end time can’t be before the start time.",
      fieldErrors: { endsAt: "The end time can’t be before the start time." },
    };
  }

  try {
    const supabase = await createClient();
    const imageUrl = submittedEventImageUrl(supabase, session.userId, formData);

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
      image_url: imageUrl,
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

    // Coarse backstop against a distributed spam run through one event: cap
    // freshly-created pending bookings in a short window. Set generously (a real
    // meet-up won't see this many new guests in 10 min) so it can't block genuine
    // bookings; the per-email resend throttle below is the primary anti-abuse gate.
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recentPending } = await admin
      .from("event_bookings")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "pending")
      .gte("created_at", tenMinutesAgo);
    if ((recentPending ?? 0) > 60) {
      return { status: "error", message: "Lots of booking requests just now — please try again shortly." };
    }

    // One active booking per (event, email): reuse a pending one (resend the
    // link, throttled), or tell them they're already in.
    const { data: existing } = await admin
      .from("event_bookings")
      .select("id, status, guest_name, updated_at")
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
      // ANTI EMAIL-BOMB: a pending booking already exists for this address, so
      // don't re-send the confirm email if one went out recently. Re-submitting
      // the public form with a victim's email therefore can't trigger more than
      // one email per window (updated_at is bumped each time one is sent).
      const lastSentMs = existing.updated_at ? new Date(existing.updated_at as string).getTime() : 0;
      if (Date.now() - lastSentMs < 5 * 60 * 1000) {
        return { status: "success", message: "Almost there — check your email to confirm your spot." };
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
    // Point at the click-to-confirm LANDING PAGES, not a side-effectful GET.
    // Email link-scanners (SafeLinks etc.) auto-fetch every URL in an inbound
    // message; a GET that mutates would let a scanner confirm then cancel a
    // booking before the guest ever clicks. These pages only render on GET; the
    // mutation happens on the button POST (a server action) a human triggers.
    const confirmUrl = new URL("/events/confirm", siteUrl);
    confirmUrl.searchParams.set("booking", bookingId);
    confirmUrl.searchParams.set("token", token);
    const cancelUrl = new URL("/events/cancel", siteUrl);
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
    // Reset the resend window (a new insert already has updated_at ≈ now).
    if (!newlyInserted) {
      await admin.from("event_bookings").update({ updated_at: new Date().toISOString() }).eq("id", bookingId);
    }
  } catch {
    return { status: "error", message: "Couldn’t start your booking. Please try again." };
  }

  if (slug) revalidatePath(`/events/${slug}`);
  return { status: "success", message: "Almost there — check your email to confirm your spot." };
}

// ============================================================================
// GUEST confirm / cancel -- the actions behind the click-to-confirm landing
// pages (/events/confirm, /events/cancel). Invoked ONLY by the page's button
// POST, never by the emailed link: the link opens a page (a safe GET), and only
// a human clicking the button reaches these, so email link-scanners can't
// silently confirm-then-cancel a booking. The HMAC token (re-verified here) is
// the authorisation -- a guest has no session -- and the service-role RPCs are
// the sole callers of the locked-down confirm_guest_booking/cancel_guest_booking
// functions. Both redirect back to the event with a banner flag.
// ============================================================================

/** Resolve the event's public base path for a booking id, for the post-action redirect. */
async function guestBookingBasePath(admin: ReturnType<typeof createAdminClient>, bookingId: string): Promise<string> {
  const { data } = await admin
    .from("event_bookings")
    .select("event:events(slug)")
    .eq("id", bookingId)
    .maybeSingle();
  const slug = (data as { event?: { slug?: string } } | null)?.event?.slug ?? null;
  return slug ? `/events/${slug}` : "/events";
}

export async function confirmGuestBooking(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("booking") ?? "");
  const token = String(formData.get("token") ?? "");
  let target = "/events?guest=error";
  if (bookingId && token && (await verifyBookingToken(bookingId, token))) {
    try {
      const admin = createAdminClient();
      const base = await guestBookingBasePath(admin, bookingId);
      const { data, error } = await admin.rpc("confirm_guest_booking", { p_booking_id: bookingId });
      target = error ? `${base}?guest=error` : `${base}?guest=${String(data)}`; // 'confirmed' | 'waitlisted'
    } catch {
      target = "/events?guest=error";
    }
  }
  redirect(target);
}

export async function cancelGuestBooking(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("booking") ?? "");
  const token = String(formData.get("token") ?? "");
  let target = "/events?guest=error";
  if (bookingId && token && (await verifyBookingToken(bookingId, token))) {
    try {
      const admin = createAdminClient();
      const base = await guestBookingBasePath(admin, bookingId);
      const { error } = await admin.rpc("cancel_guest_booking", { p_booking_id: bookingId });
      target = error ? `${base}?guest=error` : `${base}?guest=cancelled`;
    } catch {
      target = "/events?guest=error";
    }
  }
  redirect(target);
}
