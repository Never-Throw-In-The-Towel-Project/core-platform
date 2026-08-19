import "server-only";
import type { Company, SupportUrgency } from "@/types/database";
import { renderBrandedEmail } from "@/lib/email/layout";
import { sendBrandedEmail } from "@/lib/email/brevo";

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
 *
 * Phase 5 hardening (see docs/ARCHITECTURE.md "Ask for Support hardening"):
 * if EVERY attempted channel fails, or a later Twilio delivery-status
 * callback confirms the SMS failed and email didn't succeed either, this
 * escalates to a global NTITT fallback contact (not the company's own
 * contact, which is the one that just failed) -- see escalateSupportRequest.
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

export interface EscalationResult {
  reason: "dispatch_failed" | "delivery_failed" | "no_response_timeout";
  escalatedAt: string;
  sms: ChannelResult;
  email: ChannelResult;
}

export interface DeliveryStatus {
  sms: ChannelResult;
  email: ChannelResult;
  escalation?: EscalationResult;
}

const URGENCY_LABEL: Record<SupportUrgency, string> = {
  check_in: "wants a check-in (not urgent)",
  talk_today: "would like to talk today",
  urgent: "URGENT — needs contact now",
};

export async function dispatchSupportAlert(input: SupportAlertInput): Promise<DeliveryStatus> {
  const ackUrl = await buildAckUrl(input.requestId);
  const [sms, email] = await Promise.all([sendSms(input, ackUrl), sendEmail(input, ackUrl)]);

  const status: DeliveryStatus = { sms, email };

  // Both channels attempted-and-failed (or neither configured) at dispatch
  // time -- don't wait for the async Twilio callback, escalate now.
  if (!sms.ok && !email.ok) {
    status.escalation = await escalateSupportRequest(input, "dispatch_failed");
  }

  return status;
}

/**
 * Called from the Twilio status webhook when an async delivery status
 * confirms failure. Only escalates if email didn't already succeed at
 * dispatch time -- if email is confirmed sent, the contact has a real shot
 * at seeing the request even though SMS specifically failed, so this
 * doesn't need to page the fallback contact on every partial SMS failure.
 */
export async function escalateOnDeliveryFailureIfNeeded(
  input: SupportAlertInput,
  emailWasOk: boolean
): Promise<EscalationResult | null> {
  if (emailWasOk) return null;
  return escalateSupportRequest(input, "delivery_failed");
}

export async function escalateOnResponseTimeout(
  input: SupportAlertInput
): Promise<EscalationResult> {
  return escalateSupportRequest(input, "no_response_timeout");
}

async function escalateSupportRequest(
  input: SupportAlertInput,
  reason: EscalationResult["reason"]
): Promise<EscalationResult> {
  const fallbackPhone = process.env.NTITT_FALLBACK_CONTACT_PHONE;
  const fallbackEmail = process.env.NTITT_FALLBACK_CONTACT_EMAIL;

  const escalationInput: SupportAlertInput = {
    ...input,
    company: {
      ...input.company,
      support_contact_phone: fallbackPhone ?? null,
      support_contact_email: fallbackEmail ?? null,
      support_contact_name: "NTITT (escalation)",
    },
  };

  const reasonLabel: Record<EscalationResult["reason"], string> = {
    dispatch_failed: "the company's contact could not be reached (send failed)",
    delivery_failed: "the company's contact could not be reached (delivery failed)",
    no_response_timeout: "no one has acknowledged this request in time",
  };

  const ackUrl = await buildAckUrl(input.requestId);
  const escalationBody = `ESCALATION -- ${input.company.name}: ${reasonLabel[reason]}. ${buildMessageBody(input, ackUrl)}`;

  const [sms, email] = await Promise.all([
    sendSms(escalationInput, ackUrl, escalationBody),
    sendEmail(escalationInput, ackUrl, { bodyOverride: escalationBody, escalationLabel: reasonLabel[reason] }),
  ]);

  return { reason, escalatedAt: new Date().toISOString(), sms, email };
}

async function sendSms(
  input: SupportAlertInput,
  ackUrl: string,
  bodyOverride?: string
): Promise<ChannelResult> {
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
    Body: bodyOverride ?? buildMessageBody(input, ackUrl),
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

async function sendEmail(
  input: SupportAlertInput,
  ackUrl: string,
  opts?: { bodyOverride?: string; escalationLabel?: string }
): Promise<ChannelResult> {
  const now = new Date().toISOString();
  const { support_contact_email, support_contact_name } = input.company;

  if (!support_contact_email || !process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    return { attempted: false, ok: false, error: "not configured", at: now };
  }

  // Plaintext stays identical to the SMS body (parity + reliable fallback); the
  // HTML is the branded version built from the same structured fields.
  const text = opts?.bodyOverride ?? buildMessageBody(input, ackUrl);
  const { html } = buildSupportAlertEmail(input, ackUrl, opts?.escalationLabel);

  const res = await sendBrandedEmail({
    to: [{ email: support_contact_email, name: support_contact_name ?? undefined }],
    subject: `${opts?.escalationLabel ? "ESCALATION — " : ""}Ask for Support: ${input.company.name} — ${URGENCY_LABEL[input.urgency]}`,
    html,
    text,
  });

  if (!res.ok) {
    return { attempted: res.error !== "not configured", ok: false, error: res.error, at: now };
  }
  return { attempted: true, ok: true, providerId: res.messageId, at: now };
}

/** The branded HTML for a support alert — an urgent, scannable card: who, how
 *  urgent, best way to reach them, and a one-tap "mark handled" action. */
function buildSupportAlertEmail(
  input: SupportAlertInput,
  ackUrl: string,
  escalationLabel?: string
): { html: string } {
  const who = input.contactDisplayName?.trim() || "Someone (chose to stay anonymous)";
  const details: { label: string; value: string }[] = [
    { label: "Who", value: who },
    { label: "Urgency", value: URGENCY_LABEL[input.urgency] },
    { label: "Company", value: input.company.name },
  ];
  if (input.contactMethod?.trim()) details.push({ label: "Reach them", value: input.contactMethod.trim() });

  const { html } = renderBrandedEmail({
    preheader: `${input.company.name} — ${URGENCY_LABEL[input.urgency]}`,
    heading: escalationLabel ? "Escalation — someone needs support" : "Someone’s asked for support",
    paragraphs: escalationLabel
      ? [`${escalationLabel}. Please reach out now.`]
      : ["Someone has asked for support. Please reach out as soon as you can."],
    details,
    ...(ackUrl ? { button: { label: "I’ve got this — mark handled", url: ackUrl } } : {}),
    signoff: null,
  });
  return { html };
}

function buildMessageBody(input: SupportAlertInput, ackUrl: string): string {
  const name = input.contactDisplayName?.trim() || "Someone (chose to stay anonymous)";
  const contact = input.contactMethod ? ` Best way to reach them: ${input.contactMethod}.` : "";
  const ack = ackUrl ? ` Once you've reached out, mark it done: ${ackUrl}` : "";
  return `NTITT Ask for Support: ${name} ${URGENCY_LABEL[input.urgency]}.${contact} Respond as soon as you can.${ack}`;
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

  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const sortedKeys = Object.keys(params).sort();
  const data = sortedKeys.reduce((acc, key) => acc + key + params[key], url);
  const expected = createHmac("sha1", authToken).update(data, "utf8").digest("base64");

  return constantTimeStringsEqual(expected, signatureHeader, timingSafeEqual);
}

/**
 * timingSafeEqual throws on mismatched buffer lengths rather than just
 * returning false, and a length check ahead of it isn't itself a
 * meaningful timing leak here -- both compared values are fixed-length
 * HMAC digests (hex or base64) whose length is public knowledge, not a
 * secret being guessed byte by byte.
 */
function constantTimeStringsEqual(
  a: string,
  b: string,
  timingSafeEqual: (a: Buffer, b: Buffer) => boolean
): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Single-use-in-spirit acknowledgment link included in every alert -- the
 * "mark as contacted" action a support contact can tap without needing a
 * platform login (there's no auth flow for company support contacts /
 * Anthony / first-aiders at all). Signed the same way as the Twilio
 * signature check: an HMAC the contact can't forge, not a full auth system,
 * matching the low-stakes nature of the action (marking a request contacted
 * a little early isn't a security incident). This is what the response-time
 * monitor (see src/app/api/jobs/monitor-support-response-time) reads to
 * know a request no longer needs escalating.
 */
export async function generateAckToken(requestId: string): Promise<string | null> {
  const secret = process.env.SUPPORT_ACK_TOKEN_SECRET;
  if (!secret) return null;
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", secret).update(requestId).digest("hex");
}

export async function verifyAckToken(requestId: string, token: string): Promise<boolean> {
  const expected = await generateAckToken(requestId);
  if (expected === null) return false;
  const { timingSafeEqual } = await import("node:crypto");
  return constantTimeStringsEqual(expected, token, timingSafeEqual);
}

async function buildAckUrl(requestId: string): Promise<string> {
  const token = await generateAckToken(requestId);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!token || !siteUrl) return "";
  // Built via the URL constructor, not string concatenation: a
  // path-absolute input always replaces the base's own path entirely, so
  // this stays correct even if NEXT_PUBLIC_SITE_URL ever has a path of its
  // own tacked on (it shouldn't, but this shouldn't silently double up if it did).
  const url = new URL(`/api/support-requests/${requestId}/ack`, siteUrl);
  url.searchParams.set("token", token);
  return url.toString();
}
