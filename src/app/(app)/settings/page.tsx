import { getProfile } from "@/lib/auth/dal";
import { getPushSubscriptionStatus } from "@/lib/actions/pushSubscription";
import { TimezoneForm } from "@/components/settings/TimezoneForm";
import { PushNotificationToggle } from "@/components/settings/PushNotificationToggle";

export default async function SettingsPage() {
  const profile = await getProfile();
  const pushSubscribed = await getPushSubscriptionStatus();

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="mt-6 space-y-4">
        <TimezoneForm currentTimezone={profile.timezone} />
        <PushNotificationToggle initiallySubscribed={pushSubscribed} />
      </div>
    </main>
  );
}
