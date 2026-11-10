import Link from "next/link";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listMyRoutines } from "@/lib/routines/userRoutines";
import { RoutineComposer } from "@/components/routines/RoutineComposer";
import { RoutineRow } from "@/components/routines/RoutineRow";
import type { UserRoutine } from "@/types/database";

export const metadata = { title: "My routines" };

/**
 * Manage My Routines — the member's own recurring routines on the weekly
 * planner. Private, own-rows only (reads run under createClient("private"); RLS
 * scopes every row to the caller). Add a routine, pick the days it runs, tick it
 * off each day from the Today board. No employer or admin ever sees this.
 */
export default async function RoutinesPage() {
  const profile = await getProfile();

  let routines: UserRoutine[] = [];
  try {
    const supabase = await createClient("private");
    routines = await listMyRoutines(supabase, profile.id);
  } catch {
    // Degrade to the empty state rather than crashing the page.
  }

  const active = routines.filter((r) => r.active);
  const retired = routines.filter((r) => !r.active);

  return (
    // Dark "ink" surface, matching the Today board.
    <div data-surface="ink" className="min-h-full bg-background text-foreground">
      <main className="mx-auto max-w-2xl px-6 py-10">
        <Link href="/home" className="mb-6 inline-block text-sm text-muted hover:text-foreground">
          ← Today
        </Link>

        <header>
          <h1 className="text-4xl font-extrabold tracking-tight">My routines</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <span className="inline-block h-2.5 w-2.5 shrink-0 bg-success" aria-hidden />
            Your own routines, on your own days. Only you can see these.
          </p>
        </header>

        {/* Add a routine */}
        <section className="mt-8 border-2 border-foreground p-6">
          <h2 className="text-xl font-extrabold tracking-tight">Add a routine</h2>
          <p className="mt-1.5 text-sm text-muted">
            Give it a name, choose the days it runs, and set a time if you like. It appears on your Today board on
            those days for you to tick off.
          </p>
          <div className="mt-6">
            <RoutineComposer />
          </div>
        </section>

        {/* Active routines */}
        <section className="mt-10">
          <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
            Your routines{active.length > 0 ? ` · ${active.length}` : ""}
          </h2>
          {active.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No routines yet. Add your first one above.</p>
          ) : (
            <ul className="mt-2 divide-y divide-rule-hairline border-y border-rule-hairline">
              {active.map((r) => (
                <RoutineRow key={r.id} routine={r} />
              ))}
            </ul>
          )}
        </section>

        {/* Retired routines */}
        {retired.length > 0 && (
          <section className="mt-10 border-t border-rule-hairline pt-8">
            <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Retired</h2>
            <p className="mt-1 text-sm text-muted">
              Paused routines keep their history. Restore one to put it back on your planner.
            </p>
            <ul className="mt-2 divide-y divide-rule-hairline border-y border-rule-hairline">
              {retired.map((r) => (
                <RoutineRow key={r.id} routine={r} />
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
