import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCronRequest } from "@/lib/auth/cron";
import { DIRECT_COMPANY_ID } from "@/lib/tenant/constants";
import { startAppTrial } from "@/lib/billing/trial";
import { getUserEmail, sendGrandfatherEmail } from "@/lib/billing/notifications";

/**
 * Launch cut-over (Phase 1 B2C — PR 7). A ONE-OFF job, deliberately NOT in
 * vercel.json's recurring crons and NOT a migration: a migration would fire at
 * deploy (now, mid-test), but the grace trial must start at LAUNCH. So this lands
 * as code and is triggered by hand once, at go-live, with the CRON_SECRET bearer:
 *
 *   # preview first — who would be granted + emailed, no writes:
 *   curl -H "Authorization: Bearer $CRON_SECRET" ".../api/jobs/grandfather-existing-members?dryRun=1"
 *   # then execute:
 *   curl -H "Authorization: Bearer $CRON_SECRET" ".../api/jobs/grandfather-existing-members"
 *
 * It grants every current Direct member the no-card 7-day Pro trial and emails
 * them, so nobody is suddenly locked out of features they use today. The grant is
 * startAppTrial (the single source of truth for the one-trial-ever guard), so the
 * job is safe to re-run: a member who already has a trial or a Stripe subscription
 * is skipped and not re-emailed.
 */

export async function GET(request: NextRequest) {
  if (!(await verifyCronRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!base) {
    return NextResponse.json({ error: "NEXT_PUBLIC_SITE_URL not set" }, { status: 500 });
  }
  const settingsUrl = new URL("/settings", base).toString();
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";

  const admin = createAdminClient();

  // Every Direct-company member (only they are B2C-gated; partner members + admins
  // already have full access, so a trial would be meaningless for them).
  const { data: members, error } = await admin
    .from("profiles")
    .select("id")
    .eq("company_id", DIRECT_COMPANY_ID)
    .eq("role", "employee");
  if (error) {
    return NextResponse.json({ error: "failed to load members" }, { status: 500 });
  }
  const ids = (members ?? []).map((m) => m.id as string);

  if (dryRun) {
    // Read-only preview: who WOULD get a trial — mirrors startAppTrial's guards
    // (no prior trial, no Stripe subscription) as two bulk reads.
    const [{ data: trialed }, { data: stripeSubs }] = await Promise.all([
      admin.from("billing_customers").select("user_id").not("trial_started_at", "is", null),
      admin.from("subscriptions").select("user_id").eq("source", "stripe"),
    ]);
    const trialedSet = new Set((trialed ?? []).map((r) => r.user_id as string));
    const stripeSet = new Set((stripeSubs ?? []).map((r) => r.user_id as string));
    const eligible = ids.filter((id) => !trialedSet.has(id) && !stripeSet.has(id)).length;
    return NextResponse.json({ ok: true, dryRun: true, total: ids.length, wouldGrant: eligible });
  }

  let granted = 0;
  let emailed = 0;
  let skipped = 0;
  let failed = 0;
  for (const id of ids) {
    const res = await startAppTrial({ userId: id, companyId: DIRECT_COMPANY_ID, role: "employee" });
    if (res.ok) {
      granted += 1;
      const email = await getUserEmail(id);
      if (email) {
        const sent = await sendGrandfatherEmail(email, settingsUrl);
        if (sent.ok) emailed += 1;
      }
    } else if (res.reason === "error") {
      // A real write failure for this member; the rest of the batch still runs.
      failed += 1;
    } else {
      // not_eligible / already_used / already_subscribed — expected, idempotent skip.
      skipped += 1;
    }
  }

  return NextResponse.json({ ok: true, total: ids.length, granted, emailed, skipped, failed });
}
