"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/home", label: "Today" },
  { href: "/community", label: "Feed" },
  { href: "/events", label: "Events" },
  { href: "/content", label: "Library" },
] as const;

/**
 * The four primary tabs in the desktop ink header. Active tab is the vivid
 * accent-light (#ff563c on ink); a route counts as active when the path is
 * the tab's href or a sub-path of it (so /community/wins keeps Feed lit).
 * Hidden below lg -- on mobile these live in the bottom tab bar instead.
 * (Journey moved to Settings; the community section is labelled "Feed" here.)
 */
export function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-6 lg:flex">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
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
