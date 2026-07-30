import { requireHrAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

// Placeholder proving the aggregate-only boundary works end to end: this
// page reads exactly one table, scoped by RLS to the admin's own company,
// and that table has never once had a row written by anything other than
// the support-count trigger / aggregation job. The full dashboard
// (participation trends, most/least engaged day, 30/90-day completion,
// auto-generated 90-day PDF) is Phase 4 -- see docs/ARCHITECTURE.md.
export default async function DashboardPage() {
  const profile = await requireHrAdmin();
  const supabase = await createClient();

  const { data: supportCounts } = await supabase
    .from("company_support_counts")
    .select("total_count")
    .eq("company_id", profile.company_id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-bold">Company Dashboard</h1>
      <p className="mt-2 text-sm text-brand-foreground/70">
        Aggregate, anonymised data only. No individual answers, names, or scores.
      </p>
      <dl className="mt-8 rounded-lg border border-white/10 p-6">
        <dt className="text-sm opacity-70">Ask for Support uses (all time)</dt>
        <dd className="text-3xl font-bold">{supportCounts?.total_count ?? 0}</dd>
      </dl>
    </main>
  );
}
