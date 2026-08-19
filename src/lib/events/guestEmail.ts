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
