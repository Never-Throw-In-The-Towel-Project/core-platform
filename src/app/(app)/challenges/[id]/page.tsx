import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/dal";
import { getChallenge, getChallengeDays, getMyEnrollment, getMyCompletedDayIds } from "@/lib/challenges/queries";
import { ChallengeExperience, type ChallengeDayView } from "@/components/challenges/ChallengeExperience";
import type { Challenge, ChallengeDayWithContent, VideoCategory } from "@/types/database";

const CATEGORY_LABEL: Record<VideoCategory, string> = {
  mental_fitness: "Mental Fitness",
  physical_fitness: "Physical Fitness",
  nutrition: "Nutrition",
  tools_tips: "Tools & Tips",
};

/**
 * A single challenge: its days, and the member's own progress. A member reaches
 * this only for a published challenge (RLS); an ntitt_admin can also preview a
 * draft here. Progress is "X of Y done" and never "you're on day N" — see the
 * migration's "no day numbers" note.
 */
export default async function ChallengeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile();

  let challenge: Challenge | null = null;
  let days: ChallengeDayWithContent[] = [];
  let enrolled = false;
  let completedIds: string[] = [];
  try {
    const supabase = await createClient();
    const privateClient = await createClient("private");
    challenge = await getChallenge(supabase, id);
    if (challenge) {
      const [daysResult, enrollment, completed] = await Promise.all([
        getChallengeDays(supabase, id),
        getMyEnrollment(privateClient, profile.id, id),
        getMyCompletedDayIds(privateClient, profile.id, id),
      ]);
      days = daysResult;
      enrolled = enrollment !== null;
      completedIds = Array.from(completed);
    }
  } catch {
    challenge = null;
  }

  if (!challenge) notFound();

  const completedSet = new Set(completedIds);
  const completedCount = days.filter((d) => completedSet.has(d.id)).length;
  const pct = challenge.length_days > 0 ? Math.min(100, Math.round((completedCount / challenge.length_days) * 100)) : 0;

  const dayViews: ChallengeDayView[] = days.map((d) => ({
    id: d.id,
    day_index: d.day_index,
    prompt: d.prompt,
    content: d.content ? { id: d.content.id, title: d.content.title, type: d.content.type } : null,
  }));

  return (
    // Dark "ink" surface, matching the Today board. The dark hero band merges
    // seamlessly into the ink body (like the Wins/Events heroes); the body
    // below adapts via the ground tokens the scope remaps.
    <main data-surface="ink" className="min-h-full bg-background text-foreground">
      <section className="bg-brand-background text-brand-foreground">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Link
            href="/challenges"
            className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-light-2 hover:underline"
          >
            ← All challenges
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="font-extrabold uppercase tracking-[0.16em] text-brand-accent-light-2">
              {CATEGORY_LABEL[challenge.category]}
            </span>
            <span className="text-muted-on-ink-2">{challenge.length_days} days</span>
            {!challenge.is_published && (
              <span className="border border-brand-foreground/30 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-on-ink-2">
                Draft preview
              </span>
            )}
          </div>
          <h1 className="mt-2 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">{challenge.title}</h1>
          {challenge.summary && <p className="mt-4 max-w-xl text-muted-on-ink-2">{challenge.summary}</p>}

          {enrolled && (
            <div className="mt-6 max-w-sm">
              <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-on-ink-2">
                <span>Your progress</span>
                <span>
                  {completedCount} of {challenge.length_days} done
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 w-full bg-brand-foreground/20"
                role="progressbar"
                aria-valuenow={completedCount}
                aria-valuemin={0}
                aria-valuemax={challenge.length_days}
                aria-label={`${completedCount} of ${challenge.length_days} days complete`}
              >
                <div className="h-full bg-brand-accent-light-2" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <ChallengeExperience challengeId={challenge.id} enrolled={enrolled} days={dayViews} completedIds={completedIds} />
      </div>
    </main>
  );
}
