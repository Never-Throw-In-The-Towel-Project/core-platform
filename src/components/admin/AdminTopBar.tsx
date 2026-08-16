"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeAdminSection } from "./adminSections";

/**
 * The Admin Centre top bar (desktop) — the dark breadcrumb strip above each
 * page, with the red accent line under it. Left: ADMIN / <section>. Right: the
 * platform-wide super-admin context. Hidden below md (AdminMobileHeader shows
 * the brand + nav there instead).
 */
export function AdminTopBar() {
  const pathname = usePathname();
  const section = activeAdminSection(pathname);

  return (
    <header className="hidden md:block">
      <div className="flex items-center justify-between gap-4 bg-brand-background px-6 py-3 text-brand-foreground">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em]">
          <Link href="/admin" className="text-brand-accent-light-2 transition-opacity hover:opacity-80">
            Admin
          </Link>
          <span className="text-muted-on-ink-2">/</span>
          <span className="text-brand-foreground">{section?.label ?? "Overview"}</span>
        </nav>
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.16em]">
          <span className="text-muted-on-ink">All workspaces</span>
          <span className="text-ink-hairline">|</span>
          <span className="text-brand-foreground">Super admin</span>
        </div>
      </div>
      <div className="h-0.5 bg-brand-accent" />
    </header>
  );
}
