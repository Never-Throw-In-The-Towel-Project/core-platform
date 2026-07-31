import { getProfile } from "@/lib/auth/dal";
import { TimezoneForm } from "@/components/settings/TimezoneForm";

export default async function SettingsPage() {
  const profile = await getProfile();

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="mt-6">
        <TimezoneForm currentTimezone={profile.timezone} />
      </div>
    </main>
  );
}
