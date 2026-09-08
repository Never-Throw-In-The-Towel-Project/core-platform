"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV_TABS } from "@/lib/app/primaryNav";

/**
 * The bottom tab bar (Today · Feed · Wins · Events · Library), from the
 * redesign's mobile composition: the active tab gets a 3px vivid-accent top
 * border and ink text, the rest a quiet muted label. The active rule comes from
 * each tab's `match` (see lib/app/primaryNav.ts -- Feed and Wins are mutually
 * exclusive even though both live under /community).
 *
 * Mobile/tablet only (lg:hidden) -- on desktop the primary tabs live in the ink
 * AppHeader instead, matching the design's desktop composition.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-10 flex bg-background pb-[env(safe-area-inset-bottom)] text-[11px] font-extrabold uppercase tracking-wide lg:hidden">
      {PRIMARY_NAV_TABS.map((tab) => {
        const isActive = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={
              "flex-1 border-t-[3px] px-2 py-3 text-center " +
              (isActive
                ? "border-brand-accent-vivid text-foreground"
                : "border-rule-hairline text-muted hover:text-foreground")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
