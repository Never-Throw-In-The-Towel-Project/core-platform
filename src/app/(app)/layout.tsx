import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { AskForSupport } from "@/components/AskForSupport";
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
// Chrome is the redesign's ink header (primary nav + company chip + desktop
// support link) plus, on mobile, the support bar + bottom tab bar that every
// member screen shares.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  // First-run gate: /onboarding lives outside (app) precisely so it isn't
  // itself caught by this redirect.
  if (!profile.onboarding_completed) {
    redirect("/onboarding");
  }

  const helplineNumber = resolveHelplineNumber();
  const { name: companyName, skinColor } = await getCompanySkin(profile.company_id);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader
        profile={profile}
        companyName={companyName}
        skinColor={skinColor}
        helplineNumber={helplineNumber}
      />
      <div className="flex-1">{children}</div>
      {/* Mobile only: the support bar sits directly above the bottom tab bar,
          keeping the "always visible" support entry point reachable on pages
          taller than the viewport. On desktop the header carries support and
          the primary tabs, so both of these are lg:hidden (inside their own
          components / here). */}
      <div className="sticky bottom-0 z-10 bg-background lg:hidden">
        <AskForSupport helplineNumber={helplineNumber} variant="inline" />
        <BottomNav />
      </div>
    </div>
  );
}
