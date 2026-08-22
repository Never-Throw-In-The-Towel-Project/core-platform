import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { OverviewDashboard } from "@/components/admin/overview/OverviewDashboard";
import { emptyAdminOverview, getAdminOverview, type AdminOverviewData } from "@/lib/admin/overview";

/**
 * The Admin Centre home — a live Overview of the platform: what's published and
 * queued, how the community is moving, events and bookings, with quick links
 * into every management surface. Guard is on the layout; re-asserted here as
 * defence in depth (the codebase pattern).
 *
 * Every number is aggregate/operational content-and-community data read through
 * the admin's own RLS-scoped session. Nothing here reads the private schema or
 * surfaces any member's check-ins, ratings or reviews — that boundary is a
 * product promise, enforced by what this page queries (see lib/admin/overview.ts).
 */
export default async function AdminHomePage() {
  await requireNtittAdmin();

  // createClient() throws synchronously on a missing/malformed URL/key — degrade
  // to the zero-state (which renders the same empty tiles) rather than crashing
  // the Admin Centre home. Same guard the other admin pages use.
  let data: AdminOverviewData = emptyAdminOverview();
  try {
    const supabase = await createClient();
    data = await getAdminOverview(supabase);
  } catch {
    data = emptyAdminOverview();
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <AdminPageHeader
        title="Overview"
        description="A live read on the platform — content, community and events at a glance, with quick links into every surface. Aggregate and operational data only; members' private check-ins and reviews are never shown here."
      />
      <div className="mt-8">
        <OverviewDashboard data={data} />
      </div>
    </main>
  );
}
