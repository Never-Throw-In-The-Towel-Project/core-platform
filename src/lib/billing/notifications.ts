import "server-only";
import { renderBrandedEmail } from "@/lib/email/layout";
import { sendBrandedEmail } from "@/lib/email/brevo";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Billing lifecycle emails (Phase 1 B2C — PR 6).
 *
 * The 7-day Pro trial is an APP-level trial (source 'app_trial', no card, no
 * Stripe subscription) — so Stripe can't remind the member it's ending; only we
 * can. The trial-reminders cron (src/app/api/jobs/trial-reminders) uses these to
 * nudge a member a day or two before their trial lapses.
 *
 * The email builders are PURE ({subject,html,text}) and unit-tested; the send
 * wrappers and the auth-admin email lookup are the server-only I/O around them.
 * Failed-PAYMENT dunning emails are deliberately NOT here: Stripe sends those
 * natively (Dashboard → Billing → Customer emails), and our in-app past_due
 * surfaces (Settings billing + the /upgrade notice) cover the in-product nudge.
 */

/** Human phrasing for how long is left: the cron reminds inside a 2-day window. */
function endsWhen(daysLeft: number): string {
  return daysLeft <= 1 ? "tomorrow" : `in ${daysLeft} days`;
}

/** Trial-ending reminder. Pure + testable. `settingsUrl` is the absolute link
 *  to the member's billing settings (where they add a card to keep Pro). */
export function buildTrialEndingEmail(
  daysLeft: number,
  settingsUrl: string
): { subject: string; html: string; text: string } {
  const when = endsWhen(daysLeft);
  const { html, text } = renderBrandedEmail({
    preheader: `Your free trial ends ${when} — add a card to keep Pro.`,
    heading: `Your free trial ends ${when}`,
    paragraphs: [
      "You've been on the full NTITT Pro experience — your morning and night routines, the weekly planner and reviews, the Library, challenges and the community.",
      "To keep all of that when your trial ends, add a card. Prefer not to? You'll simply move to the free plan — you keep your account and everything in it either way.",
    ],
    button: { label: "Keep my Pro access", url: settingsUrl },
    afterButton: ["No charge until you add a card, and you can cancel any time."],
  });
  return { subject: `Your NTITT Pro trial ends ${when}`, html, text };
}

/** Look up a member's email via the service-role auth admin API. Returns null
 *  (never throws) when the user is gone or the lookup fails, so a single bad row
 *  can't wedge a batch cron. */
export async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) return null;
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

/** Send the trial-ending reminder. Degrades (never throws) on a send failure,
 *  mirroring sendBrandedEmail's own graceful no-op. */
export async function sendTrialEndingEmail(
  to: string,
  daysLeft: number,
  settingsUrl: string
): Promise<{ ok: boolean; error?: string }> {
  const { subject, html, text } = buildTrialEndingEmail(daysLeft, settingsUrl);
  return sendBrandedEmail({ to, subject, html, text });
}
