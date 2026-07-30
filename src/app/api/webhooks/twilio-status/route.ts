import { NextResponse, type NextRequest } from "next/server";
import { escalateOnDeliveryFailureIfNeeded, verifyTwilioSignature } from "@/lib/support/alert";
import { createAdminClient } from "@/lib/supabase/admin";

const FAILURE_STATUSES = new Set(["failed", "undelivered"]);

/**
 * Twilio calls this back as an SMS's delivery status changes (queued ->
 * sent -> delivered / failed / undelivered). Phase 5 hardening: a
 * failed/undelivered status now escalates to the NTITT fallback contact if
 * email didn't already succeed at dispatch time -- see
 * escalateOnDeliveryFailureIfNeeded in src/lib/support/alert.ts.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  const signature = request.headers.get("x-twilio-signature");
  const url = process.env.TWILIO_STATUS_CALLBACK_URL ?? request.url;

  const isValid = await verifyTwilioSignature(url, params, signature);
  if (!isValid) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  }

  const messageSid = params.MessageSid;
  const messageStatus = params.MessageStatus; // queued|sending|sent|delivered|undelivered|failed
  if (!messageSid || !messageStatus) {
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  }

  const privateClient = createAdminClient("private");

  // Service role is required here: this is an unauthenticated webhook with
  // no user session to scope an RLS-respecting query to, and the row being
  // updated belongs to whichever user submitted the original request, not
  // Twilio. The signature check above is what establishes trust instead.
  const { data: matches } = await privateClient
    .from("support_requests")
    .select("id, company_id, contact_display_name, urgency, contact_method, delivery_status")
    .filter("delivery_status->sms->>providerId", "eq", messageSid)
    .limit(1);

  const match = matches?.[0];
  if (!match) {
    // Nothing to update -- still 200 so Twilio doesn't retry indefinitely.
    return NextResponse.json({ ok: true, note: "no matching request" });
  }

  let updatedDeliveryStatus = {
    ...match.delivery_status,
    sms: {
      ...match.delivery_status.sms,
      deliveryConfirmedStatus: messageStatus,
      deliveryConfirmedAt: new Date().toISOString(),
    },
  };

  if (FAILURE_STATUSES.has(messageStatus) && !updatedDeliveryStatus.escalation) {
    const publicClient = createAdminClient();
    const { data: company } = await publicClient
      .from("companies")
      .select("name, support_contact_name, support_contact_phone, support_contact_email")
      .eq("id", match.company_id)
      .single();

    if (company) {
      const escalation = await escalateOnDeliveryFailureIfNeeded(
        {
          requestId: match.id,
          company,
          contactDisplayName: match.contact_display_name,
          urgency: match.urgency,
          contactMethod: match.contact_method,
        },
        updatedDeliveryStatus.email?.ok === true
      );

      if (escalation) {
        updatedDeliveryStatus = { ...updatedDeliveryStatus, escalation };
      }
    }
  }

  await privateClient
    .from("support_requests")
    .update({ delivery_status: updatedDeliveryStatus })
    .eq("id", match.id);

  return NextResponse.json({ ok: true });
}
