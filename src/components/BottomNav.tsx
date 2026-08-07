"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/home", label: "Today" },
  { href: "/community", label: "Community" },
  { href: "/content", label: "Library" },
  { href: "/journey", label: "Journey" },
] as const;

/**
 * The four-tab bottom bar in the design reference's Rail mockups. A route
 * is "active" if the current path is that tab's href or a sub-path of it
 * (e.g. /community/wins highlights the Community tab).
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-current/10 bg-background text-xs font-semibold tracking-wide uppercase">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={
              "flex-1 border-t-2 px-2 py-3 text-center " +
              (isActive ? "border-brand-accent text-brand-accent" : "border-transparent opacity-60 hover:opacity-100")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
