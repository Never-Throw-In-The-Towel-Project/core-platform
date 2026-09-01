import Link from "next/link";
import { getProfile } from "@/lib/auth/dal";
import { getActiveDayCount } from "@/lib/routines/dayState";
import { MorningRoutineForm } from "@/components/routines/MorningRoutineForm";

// What the Rail's "Start morning routine" card opens into (see
// src/app/(app)/home/page.tsx) -- a dedicated screen rather than the form
// rendering inline on /home, matching the design reference's "Rail" pattern
// of one focal thing at a time.
export default async function MorningRoutinePage() {
  const profile = await getProfile();
  const activeDayCount = await getActiveDayCount(profile.id);

  return (
    // Dark "ink" surface, matching the Today board. Full-width wrapper carries
    // the scope + ground paint; the <main> stays the centered column.
    <div data-surface="ink" className="min-h-full bg-background text-foreground">
    <main className="mx-auto max-w-xl px-6 py-12">
      <div className="mb-6 flex items-center justify-between text-sm">
        <Link href="/home" className="text-muted hover:text-foreground">
          ← Morning Routine
        </Link>
        <span className="text-muted">Day {activeDayCount}</span>
      </div>
      <MorningRoutineForm />
    </main>
    </div>
  );
}
