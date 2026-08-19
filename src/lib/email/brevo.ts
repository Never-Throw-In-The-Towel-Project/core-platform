import "server-only";

/**
 * The ONE place the app sends email through Brevo's transactional API (Brevo v3
 * REST, `POST /v3/smtp/email`, keyed by BREVO_API_KEY; no SDK). Every app email
 * -- guest booking, support alerts, step-challenge notices, the 90-day report,
 * and (via the auth send-email hook) the Supabase Auth mails -- goes through
 * here, so the sender identity and transport live in a single module instead of
 * being re-implemented per feature.
 *
 * Sender identity is one source of truth: the NAME is fixed (EMAIL_SENDER_NAME)
 * and the ADDRESS comes from BREVO_SENDER_EMAIL (set to
 * no-reply@neverthrowinthetowel.uk, the Brevo-authenticated domain). When either
 * key is absent the send is a graceful no-op ({ ok:false, error:"not configured" })
 * -- never a throw -- so a missing key degrades a cron/action rather than 500-ing.
 */

export const EMAIL_SENDER_NAME = "Never Throw In The Towel";

export type EmailRecipient = { email: string; name?: string };
export type EmailAttachment = { name: string; contentBase64: string };

export type SendEmailArgs = {
  to: EmailRecipient[] | string;
  subject: string;
  html: string;
  text: string;
  /** Optional Reply-To (e.g. a monitored support address). */
  replyTo?: EmailRecipient;
  attachments?: EmailAttachment[];
};

export type SendEmailResult = { ok: boolean; error?: string; messageId?: string };

export async function sendBrandedEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail) return { ok: false, error: "not configured" };

  const to = (typeof args.to === "string" ? [{ email: args.to }] : args.to).filter((r) => r.email);
  if (to.length === 0) return { ok: false, error: "no recipients" };

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: EMAIL_SENDER_NAME },
        to,
        subject: args.subject,
        htmlContent: args.html,
        textContent: args.text,
        ...(args.replyTo ? { replyTo: args.replyTo } : {}),
        ...(args.attachments && args.attachments.length > 0
          ? { attachment: args.attachments.map((a) => ({ content: a.contentBase64, name: a.name })) }
          : {}),
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return { ok: false, error: data?.message ?? `HTTP ${res.status}` };
    }
    const data = await res.json().catch(() => null);
    return { ok: true, messageId: data?.messageId };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
