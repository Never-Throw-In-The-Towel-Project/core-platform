import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { BottomNav } from "@/components/BottomNav";
import { AppHeader } from "@/components/app/AppHeader";
import { getCompanySkin } from "@/lib/app/skin";
import { resolveHelplineNumber } from "@/lib/support/helpline";

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

  // The whole authenticated app is a dark "ink" surface -- declared here on the
  // shell (not per page) so the ground is ink everywhere the member goes: the
  // header, every page body, the streaming loading fallback, and the mobile
  // bottom bar all sit on near-black, with no light `body` ground showing
  // through a short page (the community feed was the visible case). Individual
  // pages may still set their own data-surface, but they no longer have to for
  // the background to be right. flex-1 stretches the shell to fill <body> (the
  // sticky-footer pattern: body is `min-h-full flex flex-col`), so the ink
  // fills the viewport on a short page too -- ThemeProvider now renders its
  // per-tenant wrapper as display:contents, so this shell is a real flex child
  // of <body> on branded tenants as well (that wrapper used to be a plain
  // block <div>, breaking flex-1 and leaving the white strip).
  return (
    <div
      data-surface="ink"
      className="flex min-h-full flex-1 flex-col bg-background text-foreground"
    >
      <AppHeader profile={profile} skinColor={skinColor} helplineNumber={helplineNumber} />
      <div className="flex-1">{children}</div>
      {/* Mobile only: the bottom tab bar. Support is no longer a bar here -- it's
          the "Check in with me" item in the account menu (the ☰), still one tap
          from every screen. On desktop the header carries support + the primary
          tabs, so this is lg:hidden. bg-background is now the ink ground (the
          data-surface="ink" scope above), so the bar reads dark on mobile. */}
      <div className="sticky bottom-0 z-10 bg-background lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
