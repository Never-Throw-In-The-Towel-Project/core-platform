import "server-only";
import { renderBrandedEmail } from "@/lib/email/layout";
import { sendBrandedEmail } from "@/lib/email/brevo";

export interface GuestBookingEmailInput {
  toEmail: string;
  guestName: string | null;
  eventTitle: string;
  eventWhen: string; // pre-formatted, e.g. "Sat 5 Sep 2026 · 6:00 pm"
  confirmUrl: string;
  cancelUrl: string;
}

/**
 * The double opt-in email for a guest event booking, sent through the shared
 * branded email layout + Brevo transactional sender. Returns { ok:false } when
 * Brevo isn't configured, so the caller degrades gracefully rather than throwing.
 *
 * The one email carries BOTH actions: a "confirm" button (claims the seat /
 * waitlists) and a "cancel" link (works any time, incl. "this wasn't me"), so a
 * guest never needs an account to manage their booking.
 */
export async function sendGuestBookingConfirmEmail(
  input: GuestBookingEmailInput
): Promise<{ ok: boolean; error?: string }> {
  const name = input.guestName?.trim();
  const { html, text } = renderBrandedEmail({
    preheader: `Confirm your spot for ${input.eventTitle}.`,
    heading: name ? `You’re almost booked in, ${name}` : "You’re almost booked in",
    paragraphs: [
      "You asked to book onto this event with Never Throw In The Towel. Confirm your spot below and we’ll save you a place.",
    ],
    details: [
      { label: "Event", value: input.eventTitle },
      { label: "When", value: input.eventWhen },
    ],
    button: { label: "Confirm your spot", url: input.confirmUrl },
    afterButton: [
      "If the event is already full you’ll join the waitlist, and we’ll move you up the moment a place frees.",
    ],
    secondaryLinks: [
      { note: "Changed your mind, or didn’t request this?", label: "Cancel any time", url: input.cancelUrl },
    ],
  });

  const res = await sendBrandedEmail({
    to: [{ email: input.toEmail, name: input.guestName ?? undefined }],
    subject: `Confirm your spot — ${input.eventTitle}`,
    html,
    text,
  });
  return { ok: res.ok, error: res.error };
}

/** Lifecycle notices for a GUEST (no account, so no push): the event they booked
 *  was cancelled, its time/place changed, or they've been moved off the waitlist.
 *  Each mirrors the member push in G1b. Best-effort -- returns { ok:false } when
 *  Brevo isn't configured rather than throwing. */
export interface GuestEventNotice {
  toEmail: string;
  guestName: string | null;
  eventTitle: string;
  eventWhen: string;
  /** Public /events/<slug> URL, when NEXT_PUBLIC_SITE_URL is set. */
  eventUrl?: string;
}

function greeting(name: string | null): string {
  const n = name?.trim();
  return n ? `Hi ${n},` : "Hi,";
}

export async function sendGuestEventCancelledEmail(input: GuestEventNotice): Promise<{ ok: boolean }> {
  const { html, text } = renderBrandedEmail({
    preheader: `${input.eventTitle} has been cancelled.`,
    heading: "An event you booked has been cancelled",
    paragraphs: [
      greeting(input.guestName),
      // Reaches both confirmed and waitlisted guests, so it must NOT assert a
      // held place (a waitlisted guest never had one) -- "nothing you need to do"
      // covers a confirmed booking's release without overstating a waitlist spot.
      `Unfortunately “${input.eventTitle}” (${input.eventWhen}) has been cancelled and won’t be going ahead. There’s nothing you need to do.`,
    ],
    details: [
      { label: "Event", value: input.eventTitle },
      { label: "When", value: input.eventWhen },
    ],
    button: input.eventUrl ? { label: "View event", url: input.eventUrl } : undefined,
  });
  const res = await sendBrandedEmail({
    to: [{ email: input.toEmail, name: input.guestName ?? undefined }],
    subject: `Cancelled — ${input.eventTitle}`,
    html,
    text,
  });
  return { ok: res.ok };
}

export async function sendGuestEventUpdatedEmail(
  input: GuestEventNotice & { what: string }
): Promise<{ ok: boolean }> {
  const { html, text } = renderBrandedEmail({
    preheader: `The ${input.what} for ${input.eventTitle} has changed.`,
    heading: "An event you booked has changed",
    paragraphs: [
      greeting(input.guestName),
      `The ${input.what} for “${input.eventTitle}” has changed. Here are the latest details — please check they still work for you.`,
    ],
    details: [
      { label: "Event", value: input.eventTitle },
      { label: "When", value: input.eventWhen },
    ],
    button: input.eventUrl ? { label: "View event", url: input.eventUrl } : undefined,
  });
  const res = await sendBrandedEmail({
    to: [{ email: input.toEmail, name: input.guestName ?? undefined }],
    subject: `Updated — ${input.eventTitle}`,
    html,
    text,
  });
  return { ok: res.ok };
}

export async function sendGuestPromotedEmail(input: GuestEventNotice): Promise<{ ok: boolean }> {
  const { html, text } = renderBrandedEmail({
    preheader: `A place opened up — you’re in for ${input.eventTitle}.`,
    heading: "You’re off the waitlist",
    paragraphs: [
      greeting(input.guestName),
      `Good news — a place opened up and you’re now booked in for “${input.eventTitle}” (${input.eventWhen}). We look forward to seeing you there.`,
    ],
    details: [
      { label: "Event", value: input.eventTitle },
      { label: "When", value: input.eventWhen },
    ],
    button: input.eventUrl ? { label: "View event", url: input.eventUrl } : undefined,
  });
  const res = await sendBrandedEmail({
    to: [{ email: input.toEmail, name: input.guestName ?? undefined }],
    subject: `You’re in — ${input.eventTitle}`,
    html,
    text,
  });
  return { ok: res.ok };
}
