import Link from "next/link";
import { redirect } from "next/navigation";
import { requireHrAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { AskForSupport } from "@/components/AskForSupport";
import { BrandMark } from "@/components/BrandMark";
import { WorkspaceNav } from "@/components/company/WorkspaceNav";
import { resolveHelplineNumber } from "@/lib/support/helpline";

/**
 * The Company HR site -- "{Company} Workspace", at /workspace. Its own shell,
 * distinct from the member app and the NTITT Control Tower. requireHrAdmin()
 * gates the whole group at the layout.
 *
 * Note what this layout deliberately does NOT do: there is no query anywhere
 * under (company) that reaches into the `private` schema. The dashboard is
 * served entirely from public.company_* aggregate tables -- see
 * docs/ARCHITECTURE.md "Privacy boundary". That's not a convention to remember,
 * it's a fact enforced by RLS: no policy on any private table ever grants
 * hr_admin access, so there is no query that *could* leak an individual's data.
 */
export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireHrAdmin();

  // First-run gate, same as (app): role-aware landing sends a not-onboarded HR
  // admin to /onboarding at login, but guard direct navigation too so nobody
  // reaches the Workspace before finishing their first-run.
  if (!profile.onboarding_completed) {
    redirect("/onboarding");
  }

  // The company name brands the workspace header. Best-effort: a transient
  // failure just falls back to a generic label, never crashes the HR site.
  let companyName = "Your company";
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("companies").select("name").eq("id", profile.company_id).maybeSingle();
    if (data?.name) companyName = data.name;
  } catch {
    // keep the default label
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-black/10">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <BrandMark tone="onLight" size={22} />
            <div>
              <p className="text-sm font-bold tracking-tight">{companyName} Workspace</p>
              <p className="text-xs opacity-60">HR admin · {profile.display_name}</p>
            </div>
          </div>
          <Link href="/home" className="text-sm underline opacity-80">
            My Today screen
          </Link>
        </div>
        <WorkspaceNav />
      </header>
      <div className="flex-1">{children}</div>
      <AskForSupport helplineNumber={resolveHelplineNumber()} />
    </div>
  );
}
