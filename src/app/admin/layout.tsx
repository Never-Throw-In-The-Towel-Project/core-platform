import { redirect } from "next/navigation";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { AdminMobileHeader } from "@/components/admin/AdminMobileHeader";
import { type AdminCounts } from "@/components/admin/adminSections";

/**
 * The NTITT Admin Centre -- the ntitt_admin-only super-admin site where
 * Anthony's team curate content, run moderation, and manage partner companies.
 * Separate from the member app (no member header / bottom nav) and the HR
 * cockpit.
 *
 * The guard lives HERE, at the layout, so every current and future /admin/*
 * page is protected by construction -- closing the fail-open risk of the old
 * arrangement, where each admin page self-guarded per-page and a new page that
 * forgot the call would be reachable by any employee.
 *
 * The shell is the "Admin Centre" design: a dark section sidebar + breadcrumb
 * top bar (the chrome), wrapping a light content area (the tool). Once the
 * domains are live this tree is served at the root of
 * admin.neverthrowinthetowel.uk (see docs/PLATFORM_STRUCTURE.md).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireNtittAdmin();

  // First-run gate (defense in depth): role-aware landing already routes a
  // not-onboarded admin to /onboarding at login; this catches direct navigation.
  if (!profile.onboarding_completed) {
    redirect("/onboarding");
  }

  // Sidebar badge counts. head:true fetches only the count, no rows -- cheap
  // even on every admin page. A transient failure degrades to no badges, never
  // a broken shell.
  let counts: AdminCounts = {};
  try {
    const supabase = await createClient();
    const [contentC, noticesC, challengesC, eventsC, moderationC, companiesC] = await Promise.all([
      supabase.from("content_items").select("*", { count: "exact", head: true }),
      supabase.from("notices").select("*", { count: "exact", head: true }),
      supabase.from("challenges").select("*", { count: "exact", head: true }),
      supabase.from("events").select("*", { count: "exact", head: true }),
      supabase.from("community_reports").select("*", { count: "exact", head: true }).eq("resolved", false),
      supabase.from("companies").select("*", { count: "exact", head: true }),
    ]);
    counts = {
      content: contentC.count ?? undefined,
      notices: noticesC.count ?? undefined,
      challenges: challengesC.count ?? undefined,
      events: eventsC.count ?? undefined,
      moderation: moderationC.count ?? undefined,
      companies: companiesC.count ?? undefined,
    };
  } catch {
    counts = {};
  }

  return (
    <div className="flex min-h-full flex-1 bg-background text-foreground">
      <AdminSidebar counts={counts} displayName={profile.display_name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileHeader counts={counts} />
        <AdminTopBar />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
