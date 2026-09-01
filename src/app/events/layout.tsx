import { headers } from "next/headers";
import { getOptionalProfile } from "@/lib/auth/dal";
import { getCompanySkin } from "@/lib/app/skin";
import { resolveHelplineNumber } from "@/lib/support/helpline";
import { resolveCompanyForHost } from "@/lib/tenant/resolve";
import { AppHeader } from "@/components/app/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { PreAuthSupport } from "@/components/PreAuthSupport";

/**
 * Events is the one route served to BOTH audiences at the same URL, so it can't
 * sit inside (app) (auth-gated) or (marketing) (always public chrome). This
 * top-level layout adapts:
 *   - signed-in, onboarded member  -> the app shell (ink header + bottom tabs),
 *     so the Events tab keeps the same chrome as every other member screen;
 *   - everyone else                -> the marketing shell (nav + crisis-support
 *     footer), the pre-auth "taster" a prospective member sees before signing up.
 * /events is added to proxy.ts PUBLIC_PATHS so the logged-out case is reachable.
 */
export default async function EventsLayout({ children }: { children: React.ReactNode }) {
  const profile = await getOptionalProfile();

  if (profile && profile.onboarding_completed) {
    const helplineNumber = resolveHelplineNumber();
    const { skinColor } = await getCompanySkin(profile.company_id);
    return (
      <div className="flex min-h-full flex-1 flex-col">
        <AppHeader profile={profile} skinColor={skinColor} helplineNumber={helplineNumber} />
        {/* Signed-in members see Events on the dark "ink" surface, matching the
            Today board and the rest of the member app. The ink scope wraps the
            page body only -- the AppHeader is already ink chrome and the
            BottomNav stays light paper, same as every other member screen. The
            logged-out marketing branch below is deliberately left light. */}
        <div data-surface="ink" className="flex-1 bg-background text-foreground">
          {children}
        </div>
        <div className="sticky bottom-0 z-10 bg-background lg:hidden">
          <BottomNav />
        </div>
      </div>
    );
  }

  const company = await resolveCompanyForHost((await headers()).get("host") ?? "");
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background text-foreground">
      <MarketingNav showSignup={!company} skinColor={company?.primary_color ?? null} />
      <div className="flex-1">{children}</div>
      <footer className="border-t border-rule-hairline px-6 py-8">
        <PreAuthSupport />
        <nav className="mt-6 flex justify-center gap-5 text-xs font-semibold text-muted" aria-label="Legal">
          <a href="/privacy" className="inline-flex min-h-[40px] items-center hover:text-foreground">Privacy Policy</a>
          <a href="/terms" className="inline-flex min-h-[40px] items-center hover:text-foreground">Terms of Service</a>
        </nav>
      </footer>
    </div>
  );
}
