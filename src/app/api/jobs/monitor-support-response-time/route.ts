import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCronRequest } from "@/lib/auth/cron";
import { escalateOnResponseTimeout, type DeliveryStatus } from "@/lib/support/alert";
import type { SupportUrgency } from "@/types/database";

// "Agree a response protocol with each company before going live" (brief) --
// these are sane defaults, not a per-company setting yet. See
// docs/ARCHITECTURE.md "Ask for Support hardening".
const TIMEOUT_MINUTES: Record<SupportUrgency, number> = {
  urgent: 15,
  talk_today: 4 * 60,
  check_in: 24 * 60,
};

/**
 * Response-time monitoring: escalates any Ask for Support request still
 * unacknowledged (status = 'new') past its urgency-specific timeout, to the
 * NTITT fallback contact. Run frequently via Vercel Cron (see vercel.json)
 * -- the 'urgent' threshold (15 min) means this needs sub-daily scheduling,
 * unlike the once-a-day aggregation job.
 *
 * "Acknowledged" means someone tapped the ack link in the original alert
 * (src/app/api/support-requests/[id]/ack) -- there's no other way
 * status flips off 'new' today. Each request only escalates once per
 * reason (checked via delivery_status.escalation already being set).
 */
export async function GET(request: NextRequest) {
  if (!(await verifyCronRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const privateClient = createAdminClient("private");
  const publicClient = createAdminClient();

  const { data: pending, error: pendingError } = await privateClient
    .from("support_requests")
    .select("id, company_id, contact_display_name, urgency, contact_method, delivery_status, created_at")
    .eq("status", "new");

  // Fail loud, not silent: a swallowed error here would skip every overdue
  // escalation for this run with no signal -- unacceptable for a safety-critical
  // flow. A 500 surfaces in logs/monitoring and the 15-min cron retries.
  if (pendingError) {
    return NextResponse.json({ error: "failed to load pending support requests" }, { status: 500 });
  }

  const overdue = (pending ?? []).filter((row) => {
    const deliveryStatus = row.delivery_status as DeliveryStatus;
    if (deliveryStatus?.escalation) return false; // already escalated (any reason) -- don't re-page
    const minutesElapsed = (Date.now() - new Date(row.created_at as string).getTime()) / 60000;
    return minutesElapsed >= TIMEOUT_MINUTES[row.urgency as SupportUrgency];
  });

  let escalatedCount = 0;
  let failedCount = 0;
  for (const row of overdue) {
    // Per-request isolation: an unexpected throw while escalating ONE overdue
    // request must not abort the loop and leave every later overdue request
    // un-escalated -- the worst failure mode for a safety-critical flow. Log
    // loudly and count it; the failed one keeps status='new' (no escalation
    // written) so the 15-min cron retries it next run.
    try {
      const { data: company } = await publicClient
        .from("companies")
        .select("name, support_contact_name, support_contact_phone, support_contact_email")
        .eq("id", row.company_id)
        .single();

      if (!company) continue;

      const escalation = await escalateOnResponseTimeout({
        requestId: row.id as string,
        company,
        contactDisplayName: row.contact_display_name as string | null,
        urgency: row.urgency as SupportUrgency,
        contactMethod: row.contact_method as string | null,
      });

      await privateClient
        .from("support_requests")
        .update({
          delivery_status: { ...(row.delivery_status as DeliveryStatus), escalation },
        })
        .eq("id", row.id)
        .eq("status", "new"); // don't overwrite if it was acknowledged in the meantime

      escalatedCount += 1;
    } catch (error) {
      failedCount += 1;
      console.error(`[cron:monitor-support] escalation failed for request ${row.id}`, error);
    }
  }

  return NextResponse.json({
    ok: true,
    checked: pending?.length ?? 0,
    escalated: escalatedCount,
    failed: failedCount,
  });
}
