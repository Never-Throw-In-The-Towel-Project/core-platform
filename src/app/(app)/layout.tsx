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
    <div className="flex min-h-full flex-1 flex-col items-center">
      {/* The design reference's Rail mockups are mobile-width shells where
          the bottom tab bar spans edge-to-edge naturally. Unconstrained on
          desktop, that same full-bleed bar stretches across the whole
          viewport while every page's own content sits narrower and
          centered inside it (each page picks its own reading-width
          max-w-*, up to max-w-5xl for Community/the HR dashboard) -- the
          bar reads as disconnected, oversized furniture rather than part
          of the same screen. Wrapping header+content+support+BottomNav in
          one shared frame, capped to the widest content width any page
          actually uses, keeps the bar (and the header) visually tied to
          the content column at every viewport size instead of just this
          one component. The side borders only show once the viewport
          exceeds the frame's own width -- on mobile/tablet the frame *is*
          the viewport, so they're invisible there, same as today. */}
      <div className="flex w-full max-w-5xl flex-1 flex-col lg:border-x lg:border-current/10">
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
        <AskForSupport helplineNumber={resolveHelplineNumber()} variant="inline" />
        <BottomNav />
      </div>
    </div>
  );
}
