import Link from "next/link";
import { AskForSupport } from "@/components/AskForSupport";
import { BrandMark } from "@/components/BrandMark";
import { HeaderNav } from "./HeaderNav";
import { AppHeaderMenu } from "./AppHeaderMenu";
import type { Profile } from "@/types/database";

/**
 * The shared ink header for the member app, from the redesign: a top skin
 * strip in the company's colour, then the ink bar with the NTITT mark and
 * wordmark, the four primary tabs (desktop), the company chip, admin/settings
 * links and the always-visible support link (desktop; the mobile support link
 * is the inline bar above the bottom nav).
 *
 * The primary tabs move into this bar on desktop and the bottom tab bar takes
 * over below lg -- so the header carries the support entry point on desktop,
 * where there is no bottom bar, keeping "support on every screen" true at every
 * width.
 */
export function AppHeader({
  profile,
  companyName,
  skinColor,
  helplineNumber,
}: {
  profile: Pick<Profile, "role" | "display_name">;
  companyName: string;
  skinColor: string;
  helplineNumber?: string;
}) {
  return (
    <header className="sticky top-0 z-30">
      {/* Company skin strip -- band + chip only ever carry the company colour. */}
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

          <div className="ml-auto flex items-center gap-4">
            {/* Company chip -- shown at every width (per the mobile design); the
                long name truncates on a phone so it can't crowd the bar. */}
            <span className="flex items-center gap-2 border border-ink-hairline px-2.5 py-1">
              <span className="h-2 w-2 shrink-0" style={{ background: skinColor }} aria-hidden />
              <span className="max-w-[34vw] truncate text-xs font-semibold sm:max-w-none">{companyName}</span>
            </span>

            {/* Desktop: secondary actions + support inline. */}
            <div className="hidden items-center gap-4 sm:flex">
              {profile.role === "hr_admin" && (
                <Link href="/workspace" className="text-xs font-semibold text-brand-foreground/70 hover:text-brand-foreground">
                  Workspace
                </Link>
              )}
              {profile.role === "ntitt_admin" && (
                <Link href="/admin" className="text-xs font-semibold text-brand-foreground/70 hover:text-brand-foreground">
                  NTITT Admin
                </Link>
              )}
              <Link href="/settings" className="text-xs font-semibold text-brand-foreground/70 hover:text-brand-foreground">
                Settings
              </Link>
              {/* Support stays inline on desktop; on mobile it's the inline bar
                  above the bottom tab bar, so it isn't in the menu. */}
              <AskForSupport helplineNumber={helplineNumber} variant="header" />
            </div>

            {/* Mobile: Settings + the role links collapse into a menu. */}
            <div className="sm:hidden">
              <AppHeaderMenu role={profile.role} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
