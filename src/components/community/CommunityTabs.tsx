"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/community", label: "Feed", match: (p: string) => p === "/community" },
  { href: "/community/wins", label: "Wins Board", match: (p: string) => p.startsWith("/community/wins") },
  { href: "/community/company", label: "My Company", match: (p: string) => p.startsWith("/community/company") },
  {
    href: "/community/guidelines",
    label: "Guidelines",
    match: (p: string) => p.startsWith("/community/guidelines"),
  },
] as const;

/**
 * The community section's sub-navigation. Restyled to the Modernist system:
 * flat uppercase, wide-tracked labels on a hairline-ruled bar, with the active
 * tab carrying the design's 3px vivid-accent underline (the same active-tab
 * treatment as the mobile BottomNav) rather than an opacity shift. A client
 * component so it can read the current path and mark the active tab; the 3px
 * border is decorative (nothing reads text against it), so it uses the true
 * NTITT red --brand-accent-vivid.
 */
export function CommunityTabs() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-rule-hairline" aria-label="Community sections">
      <div className="mx-auto max-w-5xl px-6">
        <ul className="flex gap-7 overflow-x-auto">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            return (
              <li key={tab.href} className="shrink-0">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`-mb-px block whitespace-nowrap border-b-[3px] py-3.5 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
                    active
                      ? "border-brand-accent-vivid text-foreground"
                      : "border-transparent text-muted hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
