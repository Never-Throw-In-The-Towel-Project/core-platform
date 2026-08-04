import { requireHrAdmin } from "@/lib/auth/dal";
import { AskForSupport } from "@/components/AskForSupport";
import { resolveHelplineNumber } from "@/lib/support/helpline";

// requireHrAdmin() redirects non-hr_admin users away. Note what this layout
// deliberately does NOT do: there is no query anywhere under (admin) that
// reaches into the `private` schema. The dashboard is served entirely from
// public.company_* aggregate tables -- see supabase/migrations and
// docs/ARCHITECTURE.md. That's not a convention to remember, it's a fact
// enforced by RLS: no policy on any private table ever grants hr_admin
// access, so there is no query that *could* leak an individual's data here.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireHrAdmin();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-black/10 px-6 py-4">
        <p className="text-sm opacity-70">HR Dashboard — {profile.display_name}</p>
      </header>
      <div className="flex-1">{children}</div>
      <AskForSupport companyId={profile.company_id} helplineNumber={resolveHelplineNumber()} />
    </div>
  );
}
