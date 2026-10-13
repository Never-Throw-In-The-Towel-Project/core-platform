import Link from "next/link";
import { getProfile } from "@/lib/auth/dal";
import { getActiveDayCount } from "@/lib/routines/dayState";
import { createClient } from "@/lib/supabase/server";
import { getRecentSteps } from "@/lib/steps/queries";
import { todayISODate } from "@/lib/routines/dates";
import { toNightInitial, type NightInitial } from "@/lib/routines/checkinPrefill";
import { NightRoutineForm } from "@/components/routines/NightRoutineForm";

// What the Rail's "Start night routine" card opens into (see
// src/app/(app)/home/page.tsx). Ink-dark background -- per the design
// reference, this is deliberately the one dark screen in the product, so
// the switch to evening is felt rather than announced.
export default async function NightRoutinePage() {
  const profile = await getProfile();
  const activeDayCount = await getActiveDayCount(profile.id);

  // Prefill tonight's already-saved entry + the "Steps today" value the member
  // may have logged elsewhere (e.g. the Journey card), so re-opening the routine
  // to finish or correct it reflects what's saved rather than wiping it (finding
  // E2 for the entry; steps were already prefilled). Best-effort: any failure
  // just renders a blank form -- the routine is never blocked.
  let initial: NightInitial = toNightInitial(null);
  let initialSteps: number | null = null;
  try {
    const today = todayISODate(new Date(), profile.timezone);
    const privateClient = await createClient("private");
    const [{ data: nightEntry }, entries] = await Promise.all([
      privateClient
        .from("night_entries")
        .select("no_phone_before_bed, hot_bath_or_shower, gratitude, highlight, day_rating, looking_ahead")
        .eq("user_id", profile.id)
        .eq("entry_date", today)
        .maybeSingle(),
      getRecentSteps(privateClient, profile.id, today),
    ]);
    initial = toNightInitial(nightEntry);
    const todayEntry = entries.find((e) => e.entry_date === today);
    initialSteps = todayEntry ? todayEntry.steps : null;
  } catch {
    initial = toNightInitial(null);
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
        <NightRoutineForm initial={initial} initialSteps={initialSteps} />
      </div>
    </main>
  );
}
