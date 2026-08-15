"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/home", label: "Today" },
  { href: "/community", label: "Feed" },
  { href: "/content", label: "Library" },
  { href: "/journey", label: "Journey" },
] as const;

/**
 * The four-tab bottom bar, from the redesign's mobile composition: the active
 * tab gets a 3px vivid-accent top border and ink text, the rest a quiet muted
 * label. A route is "active" if the current path is that tab's href or a
 * sub-path of it (e.g. /community/wins highlights the Community tab).
 *
 * Mobile/tablet only (lg:hidden) -- on desktop the primary tabs live in the ink
 * AppHeader instead, matching the design's desktop composition.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-10 flex bg-background text-[11px] font-extrabold uppercase tracking-wide lg:hidden">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
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
