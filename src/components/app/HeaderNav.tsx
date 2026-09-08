"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV_TABS } from "@/lib/app/primaryNav";

/**
 * The primary tabs in the desktop ink header (Today · Feed · Wins · Events ·
 * Library). Active tab is the vivid accent-light (#ff563c on ink); the active
 * rule comes from each tab's `match` (see lib/app/primaryNav.ts -- Feed and
 * Wins are mutually exclusive even though both live under /community).
 * Hidden below lg -- on mobile these live in the bottom tab bar instead.
 */
export function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-6 lg:flex">
      {PRIMARY_NAV_TABS.map((tab) => {
        const isActive = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={
              "text-xs font-extrabold uppercase tracking-[0.1em] " +
              (isActive
                ? "text-brand-accent-light-2"
                : "text-brand-foreground/70 hover:text-brand-foreground")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
