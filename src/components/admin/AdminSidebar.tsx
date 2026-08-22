"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { ADMIN_SECTIONS, isAdminSectionActive, type AdminCounts } from "./adminSections";

/**
 * The Admin Centre sidebar (desktop) — the dark rail of the super-admin shell.
 * Brand + "Admin Centre" badge, the section nav with live counts, and the
 * signed-in admin at the foot. Hidden below md, where AdminMobileHeader takes
 * over. All on the ink surface (bg-brand-background) with the on-ink tokens.
 */
export function AdminSidebar({ counts, displayName }: { counts: AdminCounts; displayName: string }) {
  const pathname = usePathname();
  const initial = (displayName.trim()[0] ?? "A").toUpperCase();

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-ink-hairline bg-brand-background text-brand-foreground md:flex">
      <div className="border-b border-ink-hairline px-5 py-5">
        <Link href="/admin" className="flex items-center gap-2.5">
          <BrandMark tone="onDark" size={26} />
          <span className="leading-none">
            <span className="block text-sm font-extrabold uppercase tracking-wide">NTITT</span>
            <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-on-ink">
              Platform
            </span>
          </span>
        </Link>
        <span className="mt-4 inline-block bg-brand-accent px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-foreground">
          Admin Centre
        </span>
        <p className="mt-3 text-[11px] leading-snug text-muted-on-ink">
          Super admin. Changes here affect every workspace.
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto py-2" aria-label="Admin sections">
        {ADMIN_SECTIONS.map((s) => {
          const active = isAdminSectionActive(pathname, s.href);
          const count = s.countKey ? counts[s.countKey] : undefined;
          return (
            <Link
              key={s.href}
              href={s.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center justify-between gap-3 border-l-2 px-5 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? "border-brand-accent bg-brand-foreground/[0.06] text-brand-foreground"
                  : "border-transparent text-muted-on-ink hover:bg-brand-foreground/[0.03] hover:text-brand-foreground"
              }`}
            >
              <span>{s.label}</span>
              {count != null && (
                <span
                  className={`text-[11px] font-extrabold tabular-nums ${
                    active ? "text-brand-accent-light-2" : "text-muted-on-ink-2"
                  }`}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-ink-hairline px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-brand-accent text-xs font-extrabold text-brand-accent-foreground">
            {initial}
          </span>
          <span className="truncate text-sm font-semibold">{displayName}</span>
        </div>
        <Link
          href="/home"
          className="mt-3 inline-block text-[11px] font-bold uppercase tracking-[0.14em] text-muted-on-ink hover:text-brand-foreground"
        >
          Exit to app →
        </Link>
      </div>
    </aside>
  );
}
