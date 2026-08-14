import Link from "next/link";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { AdminNav } from "@/components/admin/AdminNav";

/**
 * The NTITT Control Tower ("NTITT Admin") -- the ntitt_admin-only site where
 * Anthony's team curate content, run moderation, and manage partner companies.
 * Separate from the member app (no member header / bottom nav) and from the HR
 * cockpit.
 *
 * The guard lives HERE, at the layout, so every current and future /admin/*
 * page is protected by construction -- closing the fail-open risk of the old
 * arrangement, where each admin page self-guarded per-page and a new page that
 * forgot the call would be reachable by any employee.
 *
 * Own light shell (bg-background/text-foreground), like the marketing group,
 * overriding the root layout's dark default -- an admin tool, not the dark
 * member app. Once the domains are live this tree is served at the root of
 * admin.ntitt.co.uk (see docs/PLATFORM_STRUCTURE.md).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireNtittAdmin();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background text-foreground">
      <header className="border-b border-rule-hairline">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/admin" className="text-sm font-extrabold uppercase tracking-wide">
            NTITT Admin
          </Link>
          <div className="flex items-center gap-4 text-xs">
            <span className="hidden text-muted sm:inline">{profile.display_name}</span>
            <Link href="/home" className="font-semibold text-muted hover:text-foreground">
              Exit to app →
            </Link>
          </div>
        </div>
        <AdminNav />
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
