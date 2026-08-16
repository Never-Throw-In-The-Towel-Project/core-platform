"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { ADMIN_SECTIONS, type AdminCounts } from "./adminSections";

/**
 * The Admin Centre header on small screens (below md), where the desktop
 * sidebar + top bar are hidden. A compact dark brand bar over a horizontally
 * scrolling section nav, so the admin stays usable on a phone.
 */
export function AdminMobileHeader({ counts }: { counts: AdminCounts }) {
  const pathname = usePathname();

  return (
    <header className="bg-brand-background text-brand-foreground md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/admin" className="flex items-center gap-2">
          <BrandMark tone="onDark" size={20} />
          <span className="text-xs font-extrabold uppercase tracking-[0.14em]">Admin Centre</span>
        </Link>
        <Link href="/home" className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-on-ink hover:text-brand-foreground">
          Exit →
        </Link>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-ink-hairline px-2" aria-label="Admin sections">
        {ADMIN_SECTIONS.map((s) => {
          const active = pathname === s.href || pathname.startsWith(`${s.href}/`);
          const count = s.countKey ? counts[s.countKey] : undefined;
          return (
            <Link
              key={s.href}
              href={s.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-semibold ${
                active ? "border-brand-accent text-brand-foreground" : "border-transparent text-muted-on-ink"
              }`}
            >
              {s.label}
              {count != null && <span className="text-[10px] font-extrabold text-muted-on-ink-2">{count}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="h-0.5 bg-brand-accent" />
    </header>
  );
}
