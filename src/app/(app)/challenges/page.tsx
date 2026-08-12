import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/dal";
import { listChallengesWithProgress } from "@/lib/challenges/queries";
import type { ChallengeWithProgress, VideoCategory } from "@/types/database";

const CATEGORY_LABEL: Record<VideoCategory, string> = {
  mental_fitness: "Mental Fitness",
  physical_fitness: "Physical Fitness",
  nutrition: "Nutrition",
  tools_tips: "Tools & Tips",
};

/**
 * Challenges — the "container" pillar (docs/CONTENT_PLATFORM_STRATEGY.md). A
 * member browses published, guided programmes and sees their own progress on
 * each. Progress is a pure completion count ("6 of 28 done") that only ever
 * rises: there is no "day you should be on", by design (see the migration's
 * "no day numbers" note), so nothing here can read as being behind.
 */
export default async function ChallengesPage() {
  const profile = await getProfile();

  // Degrade to an empty list on a transient client/env failure, the same
  // "nothing yet" state a genuinely empty catalogue renders (cf. /content).
  let challenges: ChallengeWithProgress[] = [];
  try {
    const supabase = await createClient();
    const privateClient = await createClient("private");
    challenges = await listChallengesWithProgress(supabase, privateClient, profile.id);
  } catch {
    challenges = [];
  }

  return (
    <main className="min-h-full">
      <section className="bg-brand-background text-brand-foreground">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-light-2">
            Challenges
          </p>
          <h1 className="mt-2 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Pick a programme and build momentum.
          </h1>
          <p className="mt-4 max-w-lg text-muted-on-ink-2">
            Guided, day-by-day. Go at your own pace — every day you finish counts, and nothing is ever
            marked late.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {challenges.length === 0 ? (
          <p className="py-8 text-sm text-muted">No challenges yet — check back soon.</p>
        ) : (
          <ul className="space-y-4">
            {challenges.map((c) => {
              const pct = c.length_days > 0 ? Math.min(100, Math.round((c.completed_days / c.length_days) * 100)) : 0;
              const done = c.completed_days >= c.length_days && c.length_days > 0;
              return (
                <li key={c.id}>
                  <Link
                    href={`/challenges/${c.id}`}
                    className="block border border-rule-border p-5 transition-colors hover:bg-foreground/[0.03]"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-deep">
                        {CATEGORY_LABEL[c.category]}
                      </span>
                      <span className="text-xs text-muted">{c.length_days} days</span>
                      {c.enrolled && (
                        <span className="border border-rule-border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                          {done ? "Complete" : "Joined"}
                        </span>
                      )}
                    </div>

                    <h2 className="mt-2 text-xl font-extrabold leading-tight tracking-tight">{c.title}</h2>
                    {c.summary && <p className="mt-1 text-sm text-muted">{c.summary}</p>}

                    {c.enrolled && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
                          <span>Your progress</span>
                          <span>
                            {c.completed_days} of {c.length_days} done
                          </span>
                        </div>
                        <div
                          className="mt-1.5 h-1.5 w-full bg-foreground/10"
                          role="progressbar"
                          aria-valuenow={c.completed_days}
                          aria-valuemin={0}
                          aria-valuemax={c.length_days}
                          aria-label={`${c.completed_days} of ${c.length_days} days complete`}
                        >
                          <div className="h-full bg-brand-accent" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
