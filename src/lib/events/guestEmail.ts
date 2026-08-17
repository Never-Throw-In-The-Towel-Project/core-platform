import "server-only";

export interface GuestBookingEmailInput {
  toEmail: string;
  guestName: string | null;
  eventTitle: string;
  eventWhen: string; // pre-formatted, e.g. "Sat 5 Sep 2026 · 6:00 pm"
  confirmUrl: string;
  cancelUrl: string;
}

/**
 * The double opt-in email for a guest event booking, sent through Brevo -- the
 * same transactional-email path as the 90-day impact report and the support
 * alerts (fetch, no SDK; keyed by BREVO_API_KEY + BREVO_SENDER_EMAIL). Returns
 * { ok:false, error:"not configured" } when the keys are absent, so the caller
 * degrades gracefully rather than throwing.
 *
 * The one email carries BOTH links: "confirm" (claims the seat / waitlists) and
 * "cancel" (works any time, incl. "this wasn't me"), so a guest never needs an
 * account to manage their booking.
 */
export async function sendGuestBookingConfirmEmail(
  input: GuestBookingEmailInput
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail) return { ok: false, error: "not configured" };

  const greeting = input.guestName?.trim() ? `Hi ${input.guestName.trim()},` : "Hi,";
  // The HTML greeting must escape the (user-supplied) name, like every other
  // interpolated field below -- otherwise a name containing markup renders raw
  // in the email body. (The plaintext greeting above needs no escaping.)
  const htmlGreeting = input.guestName?.trim() ? `Hi ${escapeHtml(input.guestName.trim())},` : "Hi,";
  const textContent = `${greeting}

You asked to book onto ${input.eventTitle} (${input.eventWhen}) with Never Throw In The Towel.

Confirm your spot:
${input.confirmUrl}

If the event is already full you'll join the waitlist, and we'll move you up the moment a place frees.

Changed your mind, or didn't request this? Cancel any time:
${input.cancelUrl}

Keep on living,
Never Throw In The Towel`;

  const htmlContent = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a">
  <p>${htmlGreeting}</p>
  <p>You asked to book onto <strong>${escapeHtml(input.eventTitle)}</strong> (${escapeHtml(input.eventWhen)}) with Never Throw In The Towel.</p>
  <p><a href="${input.confirmUrl}" style="display:inline-block;background:#ec3013;color:#fff;font-weight:bold;text-decoration:none;padding:12px 22px">Confirm your spot</a></p>
  <p style="color:#555">If the event is already full you'll join the waitlist, and we'll move you up the moment a place frees.</p>
  <p style="color:#555;font-size:13px">Changed your mind, or didn't request this? <a href="${input.cancelUrl}">Cancel any time</a>.</p>
  <p style="color:#555">Keep on living,<br/>Never Throw In The Towel</p>
</div>`;

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: "Never Throw In The Towel" },
        to: [{ email: input.toEmail, name: input.guestName ?? undefined }],
        subject: `Confirm your spot — ${input.eventTitle}`,
        textContent,
        htmlContent,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return { ok: false, error: data?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
