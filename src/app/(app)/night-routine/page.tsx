import Link from "next/link";
import { getProfile } from "@/lib/auth/dal";
import { getActiveDayCount } from "@/lib/routines/dayState";
import { NightRoutineForm } from "@/components/routines/NightRoutineForm";

// What the Rail's "Start night routine" card opens into (see
// src/app/(app)/home/page.tsx). Ink-dark background -- per the design
// reference, this is deliberately the one dark screen in the product, so
// the switch to evening is felt rather than announced.
export default async function NightRoutinePage() {
  const profile = await getProfile();
  const activeDayCount = await getActiveDayCount(profile.id);

  return (
    <main className="min-h-full bg-brand-background text-brand-foreground">
      <div className="mx-auto max-w-xl px-6 py-12">
        <div className="mb-6 flex items-center justify-between text-sm opacity-80">
          <Link href="/home" className="hover:opacity-100">
            ← Night Routine
          </Link>
          <span>Day {activeDayCount}</span>
        </div>
        <NightRoutineForm />
      </div>
    </main>
  );
}
