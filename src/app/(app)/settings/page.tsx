import { getProfile, verifySession } from "@/lib/auth/dal";
import { getPushSubscriptionStatus } from "@/lib/actions/pushSubscription";
import { AccountSettingsCard } from "@/components/settings/AccountSettingsCard";
import { IdentityForm } from "@/components/settings/IdentityForm";
import { TimezoneForm } from "@/components/settings/TimezoneForm";
import { NotificationTimesForm } from "@/components/settings/NotificationTimesForm";
import { PushNotificationToggle } from "@/components/settings/PushNotificationToggle";
import { DeleteAccountForm } from "@/components/settings/DeleteAccountForm";

export default async function SettingsPage() {
  // getProfile and getPushSubscriptionStatus are independent reads; verifySession
  // is cache()-shared with getProfile, so it's effectively free.
  const [profile, pushSubscribed, session] = await Promise.all([
    getProfile(),
    getPushSubscriptionStatus(),
    verifySession(),
  ]);

  return (
    // Dark "ink" surface, matching the Today board (full-width wrapper carries
    // the scope + ground paint; the <main> stays the centered column).
    <div data-surface="ink" className="min-h-full bg-background text-foreground">
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight">Settings</h1>

      <div className="mt-8">
        <AccountSettingsCard heading="Account" displayName={profile.display_name} email={session.email} />
      </div>

      <div className="mt-10 space-y-4">
        <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Your identity</h2>
        {profile.date_of_birth === null && (
          <p className="border border-brand-accent bg-brand-accent/[0.06] p-4 text-sm">
            Finish setting up your profile — add your date of birth below so your account details are complete.
          </p>
        )}
        <IdentityForm
          currentFullName={profile.full_name}
          currentDateOfBirth={profile.date_of_birth}
          currentPreference={profile.community_identity_preference}
        />
      </div>

      <div className="mt-10 space-y-4">
        <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Reminders</h2>
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
    </div>
  );
}
