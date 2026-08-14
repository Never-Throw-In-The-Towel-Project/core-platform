import Link from "next/link";
import { AskForSupport } from "@/components/AskForSupport";
import { HeaderNav } from "./HeaderNav";
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
            <span
              className="grid h-6 w-6 place-items-center text-[11px] font-extrabold text-white"
              style={{ background: "var(--brand-accent-vivid)" }}
              aria-hidden
            >
              N
            </span>
            <span className="text-xs font-extrabold uppercase tracking-[0.13em]">
              <span className="hidden sm:inline">Never Throw In The Towel</span>
              <span className="sm:hidden">NTITT</span>
            </span>
          </Link>

          <HeaderNav />

          <div className="ml-auto flex items-center gap-4">
            <span className="hidden items-center gap-2 border border-ink-hairline px-2.5 py-1 sm:flex">
              <span className="h-2 w-2 shrink-0" style={{ background: skinColor }} aria-hidden />
              <span className="text-xs font-semibold">{companyName}</span>
            </span>

            {profile.role === "hr_admin" && (
              <Link href="/dashboard" className="text-xs font-semibold text-brand-foreground/70 hover:text-brand-foreground">
                Dashboard
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

            {/* Desktop support link (mobile keeps the inline bar above the tab
                bar). Hidden below sm so the header stays uncluttered on a
                phone, where the inline bar covers it. */}
            <span className="hidden sm:inline">
              <AskForSupport helplineNumber={helplineNumber} variant="header" />
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
