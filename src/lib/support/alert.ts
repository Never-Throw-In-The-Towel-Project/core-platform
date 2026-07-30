import "server-only";
import type { Company, SupportUrgency } from "@/types/database";

/**
 * The one flow in the platform the brief calls a failure condition if it's
 * slow: "if someone reaches out and nobody responds for hours, the system
 * has failed." This is why it's wired directly to Twilio + Brevo (fetch,
 * no SDK, no Zapier) rather than through the no-code glue used elsewhere --
 * see docs/ARCHITECTURE.md "Ask for Support reliability design".
 *
 * Both channels are always attempted, independently, and a failure in one
 * never blocks the other -- that's the escalation model: SMS failing
 * silently is exactly the scenario this exists to prevent, so a failure
 * here is recorded, not swallowed.
 */

export interface SupportAlertInput {
  requestId: string;
  company: Pick<
    Company,
    "support_contact_name" | "support_contact_phone" | "support_contact_email" | "name"
  >;
  contactDisplayName: string | null;
  urgency: SupportUrgency;
  contactMethod: string | null;
}

export interface ChannelResult {
  attempted: boolean;
  ok: boolean;
  providerId?: string; // Twilio MessageSid / Brevo messageId -- used to match async status callbacks
  error?: string;
  at: string;
}

export interface DeliveryStatus {
  sms: ChannelResult;
  email: ChannelResult;
}

const URGENCY_LABEL: Record<SupportUrgency, string> = {
  check_in: "wants a check-in (not urgent)",
  talk_today: "would like to talk today",
  urgent: "URGENT — needs contact now",
};

export async function dispatchSupportAlert(
  input: SupportAlertInput
): Promise<DeliveryStatus> {
  const [sms, email] = await Promise.all([sendSms(input), sendEmail(input)]);
  return { sms, email };
}

async function sendSms(input: SupportAlertInput): Promise<ChannelResult> {
  const now = new Date().toISOString();
  const { support_contact_phone } = input.company;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!support_contact_phone || !accountSid || !authToken || !fromNumber) {
    return { attempted: false, ok: false, error: "not configured", at: now };
  }

  const body = new URLSearchParams({
    To: support_contact_phone,
    From: fromNumber,
    Body: buildMessageBody(input),
    ...(process.env.TWILIO_STATUS_CALLBACK_URL
      ? { StatusCallback: process.env.TWILIO_STATUS_CALLBACK_URL }
      : {}),
  });

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return { attempted: true, ok: false, error: data?.message ?? `HTTP ${res.status}`, at: now };
    }

    // `queued` here is not delivery confirmation -- that arrives later via
    // the Twilio status callback (see app/api/webhooks/twilio-status). This
    // only confirms Twilio accepted the send request.
    return { attempted: true, ok: true, providerId: data.sid, at: now };
  } catch (err) {
    return { attempted: true, ok: false, error: String(err), at: now };
  }
}

async function sendEmail(input: SupportAlertInput): Promise<ChannelResult> {
  const now = new Date().toISOString();
  const { support_contact_email, support_contact_name } = input.company;
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;

  if (!support_contact_email || !apiKey || !senderEmail) {
    return { attempted: false, ok: false, error: "not configured", at: now };
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: "NTITT Platform" },
        to: [{ email: support_contact_email, name: support_contact_name ?? undefined }],
        subject: `Ask for Support: ${input.company.name} — ${URGENCY_LABEL[input.urgency]}`,
        textContent: buildMessageBody(input),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { attempted: true, ok: false, error: data?.message ?? `HTTP ${res.status}`, at: now };
    }

    return { attempted: true, ok: true, providerId: data.messageId, at: now };
  } catch (err) {
    return { attempted: true, ok: false, error: String(err), at: now };
  }
}

function buildMessageBody(input: SupportAlertInput): string {
  const name = input.contactDisplayName?.trim() || "Someone (chose to stay anonymous)";
  const contact = input.contactMethod ? ` Best way to reach them: ${input.contactMethod}.` : "";
  return `NTITT Ask for Support: ${name} ${URGENCY_LABEL[input.urgency]}.${contact} Respond as soon as you can.`;
}

/**
 * Verifies an inbound Twilio status-callback request actually came from
 * Twilio, per Twilio's request-validation algorithm: HMAC-SHA1 of the full
 * URL + sorted POST params, keyed by the auth token, base64-encoded,
 * compared to the X-Twilio-Signature header. Without this, the status
 * webhook would be an unauthenticated endpoint that can flip any support
 * request's delivery_status.
 */
export async function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signatureHeader: string | null
): Promise<boolean> {
  if (!signatureHeader) return false;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;

  const { createHmac } = await import("node:crypto");
  const sortedKeys = Object.keys(params).sort();
  const data = sortedKeys.reduce((acc, key) => acc + key + params[key], url);
  const expected = createHmac("sha1", authToken).update(data, "utf8").digest("base64");

  return expected === signatureHeader;
}
