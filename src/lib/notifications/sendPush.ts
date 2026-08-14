import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let configured = false;
let loggedMisconfig = false;

/**
 * Returns whether web push is configured, without throwing. web-push's
 * setVapidDetails validates and THROWS on a missing/bad subject or key; left
 * unguarded that throw propagated out of the dispatch cron and crashed the
 * whole run the first time any notification was due.
 *
 * Exported so the dispatch cron can check this ONCE up front and bail loudly
 * before it writes any per-user dedup rows -- otherwise a silent no-op here
 * combined with the cron's "insert dedup log, then send" ordering would mark
 * every reminder "sent today", deliver nothing, and still report success,
 * permanently suppressing that day's reminders. A misconfiguration is logged
 * (once) so it surfaces in monitoring instead of vanishing.
 */
export function isPushConfigured(): boolean {
  if (configured) return true;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    if (!loggedMisconfig) {
      console.error("[sendPush] web push not configured: VAPID_SUBJECT / NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY missing");
      loggedMisconfig = true;
    }
    return false;
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch (error) {
    if (!loggedMisconfig) {
      console.error("[sendPush] web push not configured: invalid VAPID details", error);
      loggedMisconfig = true;
    }
    return false;
  }
  configured = true;
  return true;
}

export type PushSubscriptionTarget = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = { title: string; body: string; url: string };

/**
 * Sends one push message to one subscription, called from the dispatch cron
 * (send-push-notifications) for every due (user, notification type) pair.
 * A 404/410 from the push service means the subscription is gone (browser
 * unsubscribed, site data cleared, etc.) -- cleaned up here so future runs
 * don't keep retrying a dead endpoint. Any other error is left alone; a
 * transient failure shouldn't delete a subscription that might work again
 * on the next run.
 */
export async function sendPushToSubscription(
  subscription: PushSubscriptionTarget,
  payload: PushPayload
): Promise<void> {
  if (!isPushConfigured()) return; // web push not configured -> no-op, never crash the cron

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    );
  } catch (error) {
    const statusCode = (error as { statusCode?: number } | null)?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      const supabase = createAdminClient();
      await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
    }
  }
}
