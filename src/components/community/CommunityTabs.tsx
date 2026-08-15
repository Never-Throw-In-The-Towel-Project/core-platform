"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { visibleCommunityTabs } from "@/lib/community/tabs";

/**
 * The community section's sub-navigation. Restyled to the Modernist system:
 * flat uppercase, wide-tracked labels on a hairline-ruled bar, with the active
 * tab carrying the design's 3px vivid-accent underline (the same active-tab
 * treatment as the mobile BottomNav) rather than an opacity shift. A client
 * component so it can read the current path and mark the active tab; the 3px
 * border is decorative (nothing reads text against it), so it uses the true
 * NTITT red --brand-accent-vivid.
 *
 * `showCompanyTab` hides the "My Company" space for Direct (self-signup)
 * members, whose company is the shared NTITT-Direct row -- pooling unrelated
 * strangers into one "company" feed (docs/PLATFORM_STRUCTURE.md decision 6).
 * The layout computes it from the profile; the page itself also guards.
 */
export function CommunityTabs({ showCompanyTab = true }: { showCompanyTab?: boolean }) {
  const pathname = usePathname();
  const tabs = visibleCommunityTabs(showCompanyTab);

  return (
    <nav className="border-b border-rule-hairline" aria-label="Community sections">
      <div className="mx-auto max-w-5xl px-6">
        <ul className="flex gap-7 overflow-x-auto">
          {tabs.map((tab) => {
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
