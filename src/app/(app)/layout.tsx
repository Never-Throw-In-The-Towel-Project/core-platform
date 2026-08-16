import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { BottomNav } from "@/components/BottomNav";
import { AppHeader } from "@/components/app/AppHeader";
import { createClient } from "@/lib/supabase/server";
import { resolveHelplineNumber } from "@/lib/support/helpline";

// The default NTITT skin colour when a company has none set (the brief's
// table lists NTITT itself as #ec3013). Only ever colours the top strip and
// the header chip -- never the accent.
const DEFAULT_SKIN = "#ec3013";

/**
 * Fetch the signed-in user's company name + skin colour for the header chip
 * and top strip. `companies` is public-readable (see lib/tenant/resolve.ts),
 * so the session client is enough. Defensive: any failure degrades to the
 * NTITT default rather than blocking every member screen.
 */
async function getCompanySkin(companyId: string): Promise<{ name: string; skinColor: string }> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("companies")
      .select("name, primary_color")
      .eq("id", companyId)
      .maybeSingle();
    return {
      name: data?.name ?? "NTITT",
      skinColor: data?.primary_color ?? DEFAULT_SKIN,
    };
  } catch {
    return { name: "NTITT", skinColor: DEFAULT_SKIN };
  }
}

// Everything under (app) requires a session -- enforced here via
// getProfile()/verifySession() (the hard boundary; proxy.ts's redirect is
// only the optimistic fast-path, per docs/app/guides/authentication.md).
//
// Chrome is the redesign's ink header (primary nav + company chip + support
// entry -- the desktop button, the mobile account menu) plus, on mobile, the
// bottom tab bar that every member screen shares.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  // First-run gate: /onboarding lives outside (app) precisely so it isn't
  // itself caught by this redirect.
  if (!profile.onboarding_completed) {
    redirect("/onboarding");
  }

  const helplineNumber = resolveHelplineNumber();
  const { skinColor } = await getCompanySkin(profile.company_id);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader profile={profile} skinColor={skinColor} helplineNumber={helplineNumber} />
      <div className="flex-1">{children}</div>
      {/* Mobile only: the bottom tab bar. Support is no longer a bar here -- it's
          the "Check in with me" item in the account menu (the ☰), still one tap
          from every screen. On desktop the header carries support + the primary
          tabs, so this is lg:hidden. */}
      <div className="sticky bottom-0 z-10 bg-background lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
