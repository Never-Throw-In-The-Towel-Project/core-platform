import Link from "next/link";
import { getProfile } from "@/lib/auth/dal";
import { getActiveDayCount } from "@/lib/routines/dayState";
import { createClient } from "@/lib/supabase/server";
import { getRecentSteps } from "@/lib/steps/queries";
import { todayISODate } from "@/lib/routines/dates";
import { NightRoutineForm } from "@/components/routines/NightRoutineForm";

// What the Rail's "Start night routine" card opens into (see
// src/app/(app)/home/page.tsx). Ink-dark background -- per the design
// reference, this is deliberately the one dark screen in the product, so
// the switch to evening is felt rather than announced.
export default async function NightRoutinePage() {
  const profile = await getProfile();
  const activeDayCount = await getActiveDayCount(profile.id);

  // Prefill "Steps today" with whatever the member has already logged for
  // today (e.g. on the Journey card), so re-opening the routine reflects it
  // rather than showing an empty box. Best-effort: any failure just leaves it
  // blank -- steps are optional and never block the routine.
  let initialSteps: number | null = null;
  try {
    const today = todayISODate(new Date(), profile.timezone);
    const privateClient = await createClient("private");
    const entries = await getRecentSteps(privateClient, profile.id, today);
    const todayEntry = entries.find((e) => e.entry_date === today);
    initialSteps = todayEntry ? todayEntry.steps : null;
  } catch {
    initialSteps = null;
  }

  return (
    <main className="min-h-full bg-brand-background text-brand-foreground">
      <div className="mx-auto max-w-xl px-6 py-12">
        <div className="mb-6 flex items-center justify-between text-sm text-muted-on-ink">
          <Link href="/home" className="hover:text-brand-foreground">
            ← Night Routine
          </Link>
          <span>Day {activeDayCount}</span>
        </div>
        <NightRoutineForm initialSteps={initialSteps} />
      </div>
    </main>
  );
}
