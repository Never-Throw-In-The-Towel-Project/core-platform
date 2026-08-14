import { requireHrAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getAdminChallengeView, type AdminChallengeView } from "@/lib/steps/challengeQueries";
import { todayISODate } from "@/lib/routines/dates";
import { ChallengeSetupForm } from "@/components/admin/ChallengeSetupForm";
import { ChallengeAdminTile } from "@/components/admin/ChallengeAdminTile";

/**
 * Workspace › Challenges -- the company step challenge. The team total is
 * k-anonymised (min contributors) and aggregate only; never an individual's
 * steps. Best-effort read: any failure falls back to offering the setup form.
 */
export default async function WorkspaceChallengesPage() {
  const profile = await requireHrAdmin();

  let adminChallenge: AdminChallengeView | null = null;
  try {
    const supabase = await createClient();
    adminChallenge = await getAdminChallengeView(supabase, profile.company_id);
  } catch {
    adminChallenge = null;
  }
  const todayIso = todayISODate(new Date(), "UTC");

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-lg font-bold tracking-tight">Step challenge</h1>
      <p className="mt-1 text-sm opacity-70">
        Run a company-wide step challenge. Progress is an aggregate team total — never an individual&apos;s steps.
      </p>
      <div className="mt-6">
        {adminChallenge ? <ChallengeAdminTile view={adminChallenge} todayIso={todayIso} /> : <ChallengeSetupForm />}
      </div>
    </main>
  );
}
