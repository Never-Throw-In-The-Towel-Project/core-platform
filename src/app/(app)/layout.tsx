import Link from "next/link";
import { getProfile } from "@/lib/auth/dal";
import { AskForSupport } from "@/components/AskForSupport";

// Everything under (app) requires a session -- enforced here via
// getProfile()/verifySession() (the hard boundary; proxy.ts's redirect is
// only the optimistic fast-path, per docs/app/guides/authentication.md).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-black/10 px-6 py-4">
        <p className="text-sm opacity-70">Signed in as {profile.display_name}</p>
        <nav className="flex gap-4">
          <Link href="/content" className="text-sm underline opacity-80">
            Content Library
          </Link>
          <Link href="/community" className="text-sm underline opacity-80">
            Community
          </Link>
          <Link href="/journey" className="text-sm underline opacity-80">
            My Journey
          </Link>
          {profile.role === "ntitt_admin" && (
            <>
              <Link href="/community/admin" className="text-sm underline opacity-80">
                Moderation
              </Link>
              <Link href="/admin/invite" className="text-sm underline opacity-80">
                Invite
              </Link>
            </>
          )}
          <Link href="/settings" className="text-sm underline opacity-80">
            Settings
          </Link>
        </nav>
      </header>
      <div className="flex-1">{children}</div>
      <AskForSupport companyId={profile.company_id} />
    </div>
  );
}
