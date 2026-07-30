import { NextResponse, type NextRequest } from "next/server";
import { verifyTwilioSignature } from "@/lib/support/alert";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Twilio calls this back as an SMS's delivery status changes (queued ->
 * sent -> delivered / failed / undelivered). This is what turns "we asked
 * Twilio to send it" into "we know whether it actually landed" -- the
 * escalation trigger point discussed in planning: if this callback reports
 * failed/undelivered, that's where a future iteration hooks in a fallback
 * (secondary contact, forced email-only, etc). Not implemented yet in
 * Phase 1 -- this records status; acting on a failure is a follow-up task.
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

  const supabase = createAdminClient("private");

  // Service role is required here: this is an unauthenticated webhook with
  // no user session to scope an RLS-respecting query to, and the row being
  // updated belongs to whichever user submitted the original request, not
  // Twilio. The signature check above is what establishes trust instead.
  const { data: matches } = await supabase
    .from("support_requests")
    .select("id, delivery_status")
    .filter("delivery_status->sms->>providerId", "eq", messageSid)
    .limit(1);

  const match = matches?.[0];
  if (!match) {
    // Nothing to update -- still 200 so Twilio doesn't retry indefinitely.
    return NextResponse.json({ ok: true, note: "no matching request" });
  }

  const updatedDeliveryStatus = {
    ...match.delivery_status,
    sms: {
      ...match.delivery_status.sms,
      deliveryConfirmedStatus: messageStatus,
      deliveryConfirmedAt: new Date().toISOString(),
    },
  };

  await supabase
    .from("support_requests")
    .update({ delivery_status: updatedDeliveryStatus })
    .eq("id", match.id);

  return NextResponse.json({ ok: true });
}
