import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { OverviewDashboard } from "@/components/admin/overview/OverviewDashboard";
import { emptyAdminOverview, getAdminOverview, type AdminOverviewData } from "@/lib/admin/overview";
import { emptyPeopleOverview, getPeopleOverview, type PeopleOverview } from "@/lib/admin/overviewPeople";
import { emptyEngagementOverview, getEngagementOverview, type EngagementOverview } from "@/lib/admin/overviewEngagement";

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
  // Two independent gathers, degraded independently: the content/community
  // counts read through the admin's own session (createClient), while the
  // member/tenant headcounts need the service-role client (RLS hides profiles
  // from even a super admin). Either failing degrades only its own tiles.
  let data: AdminOverviewData = emptyAdminOverview();
  try {
    const supabase = await createClient();
    data = await getAdminOverview(supabase);
  } catch {
    data = emptyAdminOverview();
  }

  let people: PeopleOverview = emptyPeopleOverview();
  try {
    people = await getPeopleOverview();
  } catch {
    people = emptyPeopleOverview();
  }

  // Cross-tenant engagement roll-up from the anonymised company_* aggregates
  // (service-role, since those tables have no ntitt_admin read policy).
  let engagement: EngagementOverview = emptyEngagementOverview();
  try {
    engagement = await getEngagementOverview();
  } catch {
    engagement = emptyEngagementOverview();
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <AdminPageHeader
        title="Overview"
        description="A live read on the platform — members, content, community and events at a glance, with quick links into every surface. Aggregate and operational data only; members' private check-ins and reviews are never shown here."
      />
      <div className="mt-8">
        <OverviewDashboard data={data} people={people} engagement={engagement} />
      </div>
    </main>
  );
}
