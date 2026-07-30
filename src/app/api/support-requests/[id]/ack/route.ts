import { NextResponse, type NextRequest } from "next/server";
import { verifyAckToken } from "@/lib/support/alert";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The "mark as contacted" link included in every Ask for Support alert
 * (SMS + email) -- see src/lib/support/alert.ts's buildMessageBody. No
 * session required: there's no auth flow for company support contacts /
 * Anthony / first-aiders, so this is token-authenticated the same way the
 * Twilio status webhook is signature-verified, not session-authenticated.
 * This is what stops src/app/api/jobs/monitor-support-response-time from
 * escalating a request someone has already actually responded to.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("token");

  if (!token || !(await verifyAckToken(id, token))) {
    return new NextResponse("This link isn't valid.", { status: 403 });
  }

  const supabase = createAdminClient("private");

  const { data, error } = await supabase
    .from("support_requests")
    .update({ status: "contacted", contacted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "new") // don't overwrite contacted_at if already acknowledged
    .select("id")
    .maybeSingle();

  if (error) {
    return new NextResponse("Something went wrong. The request has still been logged.", {
      status: 500,
    });
  }

  return new NextResponse(
    data
      ? "Thanks -- marked as contacted."
      : "Already marked as contacted. Thanks for reaching out to them.",
    { status: 200, headers: { "Content-Type": "text/plain" } }
  );
}
