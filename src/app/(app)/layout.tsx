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
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <p className="text-sm opacity-70">Signed in as {profile.display_name}</p>
        <Link href="/journey" className="text-sm underline opacity-80">
          My Journey
        </Link>
      </header>
      <div className="flex-1">{children}</div>
      <AskForSupport companyId={profile.company_id} />
    </div>
  );
}
