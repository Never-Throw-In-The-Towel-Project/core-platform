import { getProfile } from "@/lib/auth/dal";
import { getPushSubscriptionStatus } from "@/lib/actions/pushSubscription";
import { TimezoneForm } from "@/components/settings/TimezoneForm";
import { NotificationTimesForm } from "@/components/settings/NotificationTimesForm";
import { PushNotificationToggle } from "@/components/settings/PushNotificationToggle";
import { DeleteAccountForm } from "@/components/settings/DeleteAccountForm";

export default async function SettingsPage() {
  const profile = await getProfile();
  const pushSubscribed = await getPushSubscriptionStatus();

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight">Settings</h1>
      <div className="mt-6 space-y-4">
        <TimezoneForm currentTimezone={profile.timezone} />
        <NotificationTimesForm
          morningTime={profile.morning_notification_time}
          nightTime={profile.night_notification_time}
          sundayTime={profile.sunday_notification_time}
        />
        <PushNotificationToggle initiallySubscribed={pushSubscribed} />
      </div>

      <div className="mt-10 space-y-4">
        <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Your data</h2>
        <div className="border border-rule-hairline p-4">
          <p className="text-sm font-medium">Download your data</p>
          <p className="mt-1 text-xs text-muted">
            A copy of your profile, routines, reviews, steps, badges and community posts, as JSON.
          </p>
          <a
            href="/api/account/export"
            className="mt-3 inline-block border border-rule-border px-3 py-1.5 text-xs font-semibold hover:bg-foreground/[0.03]"
          >
            Download my data
          </a>
        </div>
        <DeleteAccountForm />
      </div>
    </main>
  );
}
