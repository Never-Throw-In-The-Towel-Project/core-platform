import Link from "next/link";
import { AskForSupport } from "@/components/AskForSupport";
import { BrandMark } from "@/components/BrandMark";
import { HeaderNav } from "./HeaderNav";
import { AppHeaderMenu } from "./AppHeaderMenu";
import type { Profile } from "@/types/database";

/**
 * The shared ink header for the member app: a top skin strip in the company's
 * colour, then the ink bar with the NTITT mark and wordmark, the four primary
 * tabs (desktop), and the account actions on the right -- a Settings gear, the
 * account menu (the member's initial; holds the role links + Sign out), and the
 * support CTA.
 *
 * The primary tabs move into this bar on desktop and the bottom tab bar takes
 * over below lg. The header carries the support entry point on desktop (the
 * "Get support" button); on mobile it's the "Get support" item inside the
 * account menu (the ☰) -- so "support on every screen" stays true at every
 * width, without a bar across the bottom.
 */
export function AppHeader({
  profile,
  skinColor,
  helplineNumber,
}: {
  profile: Pick<Profile, "role" | "display_name">;
  skinColor: string;
  helplineNumber?: string;
}) {
  const initial = (profile.display_name?.trim()?.charAt(0) || "?").toUpperCase();

  return (
    <header className="sticky top-0 z-30">
      {/* Company skin strip -- the one place the header carries the company colour. */}
      <div className="h-1 w-full" style={{ background: skinColor }} aria-hidden />
      <div className="bg-brand-background text-brand-foreground">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <Link href="/home" className="flex items-center gap-2.5">
            <BrandMark tone="onDark" size={26} />
            <span className="text-xs font-extrabold uppercase tracking-[0.13em]">
              <span className="hidden sm:inline">Never Throw In The Towel</span>
              <span className="sm:hidden">NTITT</span>
            </span>
          </Link>

          <HeaderNav />

          <div className="ml-auto flex items-center gap-3">
            {/* Desktop: Settings gear, account menu, and the support CTA. */}
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/settings"
                aria-label="Settings"
                className="grid h-8 w-8 place-items-center text-brand-foreground/80 hover:text-brand-foreground"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </Link>
              <AppHeaderMenu role={profile.role} trigger="avatar" initial={initial} includeSettings={false} />
              <span className="ml-1">
                <AskForSupport helplineNumber={helplineNumber} variant="header" label="Get support" />
              </span>
            </div>

            {/* Mobile: everything collapses into the account menu, which also
                carries the "Get support" entry (no bottom bar). */}
            <div className="sm:hidden">
              <AppHeaderMenu role={profile.role} trigger="hamburger" showCheckIn helplineNumber={helplineNumber} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
