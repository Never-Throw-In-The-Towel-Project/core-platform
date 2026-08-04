import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { AskForSupport } from "@/components/AskForSupport";
import { BottomNav } from "@/components/BottomNav";
import { resolveHelplineNumber } from "@/lib/support/helpline";

// Everything under (app) requires a session -- enforced here via
// getProfile()/verifySession() (the hard boundary; proxy.ts's redirect is
// only the optimistic fast-path, per docs/app/guides/authentication.md).
//
// Chrome is a slim top strip (Settings/admin-only links -- not part of the
// four primary sections) plus the bottom tab bar + support link the design
// reference's Rail mockups show as every member screen's shared furniture.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  // First-run gate: /onboarding lives outside (app) precisely so it isn't
  // itself caught by this redirect.
  if (!profile.onboarding_completed) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-black/10 px-6 py-3 text-sm">
        <p className="opacity-70">Signed in as {profile.display_name}</p>
        <nav className="flex gap-4">
          {profile.role === "hr_admin" && (
            <Link href="/dashboard" className="underline opacity-80">
              HR Dashboard
            </Link>
          )}
          {profile.role === "ntitt_admin" && (
            <>
              <Link href="/community/admin" className="underline opacity-80">
                Moderation
              </Link>
              <Link href="/community/admin/podcast-guests" className="underline opacity-80">
                Podcast Guests
              </Link>
              <Link href="/admin/invite" className="underline opacity-80">
                Invite
              </Link>
            </>
          )}
          <Link href="/settings" className="underline opacity-80">
            Settings
          </Link>
        </nav>
      </header>
      <div className="flex-1">{children}</div>
      <AskForSupport
        companyId={profile.company_id}
        helplineNumber={resolveHelplineNumber()}
        variant="inline"
      />
      <BottomNav />
    </div>
  );
}
