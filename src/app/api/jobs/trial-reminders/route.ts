import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCronRequest } from "@/lib/auth/cron";
import { getUserEmail, sendTrialEndingEmail } from "@/lib/billing/notifications";

/**
 * Trial-ending reminders. The 7-day Pro trial is app-level (source 'app_trial',
 * no Stripe subscription), so Stripe can't warn a member it's about to lapse --
 * this cron does. Run once a day (see vercel.json): it emails every member whose
 * trial ends inside the next REMINDER_WINDOW_DAYS and hasn't been reminded yet,
 * stamping subscriptions.trial_reminder_sent_at so no trial is emailed twice.
 *
 * Service-role reads/writes (the subscriptions table is member-read-only). Fails
 * loud (500) on a query error so the daily run surfaces in monitoring rather than
 * silently skipping everyone; a single bad row (missing email / send failure)
 * degrades for that member only and the batch continues.
 */
const REMINDER_WINDOW_DAYS = 2;
const DAY_MS = 86_400_000;

export async function GET(request: NextRequest) {
  if (!(await verifyCronRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!base) {
    // Without an absolute base URL the email's CTA link can't be built; fail loud.
    return NextResponse.json({ error: "NEXT_PUBLIC_SITE_URL not set" }, { status: 500 });
  }
  const settingsUrl = new URL("/settings", base).toString();

  const admin = createAdminClient();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * DAY_MS);

  // Trialing app-trials ending within the window that we haven't reminded yet.
  const { data: rows, error } = await admin
    .from("subscriptions")
    .select("user_id, trial_end")
    .eq("source", "app_trial")
    .eq("status", "trialing")
    .is("trial_reminder_sent_at", null)
    .not("trial_end", "is", null)
    .gte("trial_end", now.toISOString())
    .lte("trial_end", windowEnd.toISOString());

  if (error) {
    return NextResponse.json({ error: "failed to load trials" }, { status: 500 });
  }

  let reminded = 0;
  for (const row of rows ?? []) {
    const userId = row.user_id as string;
    const trialEnd = row.trial_end as string | null;
    if (!trialEnd) continue;

    const email = await getUserEmail(userId);
    if (!email) continue;

    const daysLeft = Math.max(1, Math.ceil((Date.parse(trialEnd) - now.getTime()) / DAY_MS));
    await sendTrialEndingEmail(email, daysLeft, settingsUrl);

    // Stamp after attempting the send (even on a soft send failure) so we never
    // re-nudge the same member on tomorrow's run. A reminder is a nicety, not a
    // safety-critical message, so "at most once" is the right trade here.
    await admin
      .from("subscriptions")
      .update({ trial_reminder_sent_at: now.toISOString() })
      .eq("user_id", userId);
    reminded += 1;
  }

  return NextResponse.json({ ok: true, reminded });
}
