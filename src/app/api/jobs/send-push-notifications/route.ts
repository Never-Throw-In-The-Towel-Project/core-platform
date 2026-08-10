import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCronRequest } from "@/lib/auth/cron";
import { localMinutesSinceMidnight, todayISODate, weekdayNameOrWeekend } from "@/lib/routines/dates";
import { sendPushToSubscription, type PushSubscriptionTarget } from "@/lib/notifications/sendPush";
import type { PushNotificationType } from "@/types/database";

// Matches this route's own schedule in vercel.json -- a user's configured
// time only needs to fall in the same bucket as "now" once per run for the
// reminder to go out on time, give or take up to 15 minutes.
const WINDOW_MINUTES = 15;

const NOTIFICATION_CONTENT: Record<PushNotificationType, { title: string; body: string; url: string }> = {
  morning: { title: "Morning Routine", body: "Start your day -- your Morning Routine is ready.", url: "/home" },
  night: { title: "Night Routine", body: "Wind down -- your Night Routine is ready.", url: "/home" },
  sunday: { title: "Sunday Setup", body: "Set your intention for the week ahead.", url: "/sunday-setup" },
};

type ProfileNotificationRow = {
  id: string;
  timezone: string;
  morning_notification_time: string | null;
  night_notification_time: string | null;
  sunday_notification_time: string | null;
};

const CONFIGURED_TIME: Record<PushNotificationType, (row: ProfileNotificationRow) => string | null> = {
  morning: (row) => row.morning_notification_time,
  night: (row) => row.night_notification_time,
  sunday: (row) => row.sunday_notification_time,
};

const FILTER_COLUMN: Record<PushNotificationType, keyof ProfileNotificationRow> = {
  morning: "morning_notification_time",
  night: "night_notification_time",
  sunday: "sunday_notification_time",
};

/**
 * Daily/weekly reminder dispatch, per notification_type, per user's own
 * configured time and timezone (Phase 9) -- what finally reads the
 * profiles.*_notification_time columns that have existed with nothing
 * reading them since Phase 1. Runs every 15 minutes (vercel.json), same
 * granularity as monitor-support-response-time, authenticated the same way
 * (CRON_SECRET bearer token) -- this is the one other route besides that
 * one that needs sub-daily scheduling.
 *
 * Dedup relies on push_notification_log's unique (user_id,
 * notification_type, sent_date) constraint: this route always tries to
 * insert a log row before sending, and skips on a unique-violation (already
 * sent today) rather than tracking "have I sent this" in memory, so
 * overlapping/retried cron invocations can't double-send.
 */
export async function GET(request: NextRequest) {
  if (!(await verifyCronRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const supabase = createAdminClient();

  let sentCount = 0;

  for (const notificationType of Object.keys(NOTIFICATION_CONTENT) as PushNotificationType[]) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, timezone, morning_notification_time, night_notification_time, sunday_notification_time")
      .not(FILTER_COLUMN[notificationType], "is", null);

    for (const profile of (profiles ?? []) as ProfileNotificationRow[]) {
      const configuredTime = CONFIGURED_TIME[notificationType](profile);
      if (!configuredTime) continue;

      const timezone = profile.timezone;

      // "sunday" is a weekly reminder, not a daily one like morning/night --
      // without this check it would fire every day the loop runs, since
      // nothing else here is day-aware. Checked in the user's own timezone,
      // same as every other "what day is it for this user" decision (see
      // docs/ARCHITECTURE.md "Per-user timezone").
      if (notificationType === "sunday" && weekdayNameOrWeekend(now, timezone) !== "sunday") {
        continue;
      }

      const nowMinutes = localMinutesSinceMidnight(now, timezone);
      const [hours, minutes] = configuredTime.split(":").map(Number);
      const configuredMinutes = hours * 60 + minutes;

      const sameWindow =
        Math.floor(nowMinutes / WINDOW_MINUTES) === Math.floor(configuredMinutes / WINDOW_MINUTES);
      if (!sameWindow) continue;

      const { error: logError } = await supabase.from("push_notification_log").insert({
        user_id: profile.id,
        notification_type: notificationType,
        sent_date: todayISODate(now, timezone),
      });
      // A unique-constraint violation means today's reminder for this user
      // already went out (an earlier run this window, or an overlapping
      // invocation) -- not a real error, just "someone else already did this."
      if (logError) continue;

      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", profile.id);

      for (const subscription of (subscriptions ?? []) as PushSubscriptionTarget[]) {
        await sendPushToSubscription(subscription, NOTIFICATION_CONTENT[notificationType]);
        sentCount += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, sent: sentCount });
}
