import Link from "next/link";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getActiveStaffChallenge, type StaffChallengeView } from "@/lib/steps/challengeQueries";
import { todayISODate } from "@/lib/routines/dates";
import { ChallengeView } from "@/components/challenge/ChallengeView";

/**
 * The company step challenge screen (brief §2). Shows the member's company's
 * active challenge, the collective team progress (an aggregate -- never an
 * individual), and the member's private opt-in. Best-effort: any failure, or no
 * active challenge, renders a gentle empty state rather than crashing.
 */
export default async function ChallengePage() {
  const profile = await getProfile();

  let view: StaffChallengeView | null = null;
  try {
    const publicClient = await createClient();
    const privateClient = await createClient("private");
    view = await getActiveStaffChallenge(publicClient, privateClient, profile.id, profile.company_id);
  } catch {
    view = null;
  }

  const todayIso = todayISODate(new Date(), profile.timezone);

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <Link href="/home" className="mb-6 inline-block text-sm opacity-70 hover:opacity-100">
        ← Today
      </Link>
      {view ? (
        <ChallengeView view={view} todayIso={todayIso} />
      ) : (
        <div>
          <h1 className="text-2xl font-extrabold uppercase">Step challenge</h1>
          <p className="mt-3 text-sm text-muted">
            There&apos;s no active step challenge right now. When your company runs one, you&apos;ll see the
            team&apos;s progress toward the target here — and you choose whether to take part.
          </p>
          <Link
            href="/journey"
            className="mt-4 inline-block text-sm font-semibold text-brand-accent-deep underline"
          >
            Back to My Journey →
          </Link>
        </div>
      )}
    </main>
  );
}
