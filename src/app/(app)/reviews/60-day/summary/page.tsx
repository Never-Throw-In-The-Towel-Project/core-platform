import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getRecentSteps } from "@/lib/steps/queries";
import { stepsStatForRange } from "@/lib/steps/reviewStats";
import { PrintButton } from "@/components/PrintButton";
import type { PeriodicReview } from "@/types/database";

/**
 * The read-only "read it back" view My Journey's milestones card links to once
 * the 60-Day Review is done -- same pattern as the 30- and 90-day summaries. It
 * shows the halfway-mark extras (progress since day one, what I've learned,
 * identity check) alongside the shared fields, plus habit completion and the
 * self-assessment against the 30-day baseline.
 */
export default async function SixtyDaySummaryPage() {
  const profile = await getProfile();

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  // Treated the same as "no review" below, since either way there's nothing
  // to safely render on this read-back page.
  let review: PeriodicReview | null = null;
  try {
    const supabase = await createClient("private");
    const { data } = await supabase
      .from("periodic_reviews")
      .select("*")
      .eq("user_id", profile.id)
      .eq("review_type", "60_day")
      .not("completed_at", "is", null)
      .maybeSingle();
    review = data;
  } catch {
    review = null;
  }

  if (!review) {
    redirect("/home");
  }

  const r = review as PeriodicReview;
  const habitSummary = r.extra.habit_summary;

  // Average daily steps across the review period -- a purely personal progress
  // metric, read only from the member's own private step_entries and shown to
  // no one else. Best-effort: any failure, or a member who never logged steps,
  // simply hides the block.
  let stepsStat = { daysLogged: 0, averageDailySteps: null as number | null };
  try {
    const supabase = await createClient("private");
    const entries = await getRecentSteps(supabase, profile.id, r.period_start);
    stepsStat = stepsStatForRange(entries, r.period_start, r.period_end);
  } catch {
    // leave the zero/null default -> block hidden
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-12 print:text-black">
      <Link href="/journey" className="mb-4 inline-block text-sm text-muted hover:text-foreground print:hidden">
        ← My Journey
      </Link>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">60-Day Summary</h1>
        <PrintButton />
      </div>

      <dl className="space-y-4 text-sm">
        <Field label="Period" value={`${r.period_start} to ${r.period_end}`} />
        <Field label="Most proud of" value={r.most_proud_of} />
        <Field label="Most consistent habits" value={r.most_consistent_habits} />
        <Field label="Challenges faced" value={r.challenges_faced} />
        <Field label="What's working" value={r.whats_working} />
        <Field label="What needs to change" value={r.needs_to_change} />
        {r.extra.progress_since_start && <Field label="Progress since day one" value={r.extra.progress_since_start} />}
        {r.extra.learned_about_myself && <Field label="What I've learned about myself" value={r.extra.learned_about_myself} />}
        {r.extra.identity_becoming && <Field label="Who I'm becoming" value={r.extra.identity_becoming} />}
        {r.top_wins.length > 0 && <Field label="Top wins" value={r.top_wins.join(" · ")} />}

        {r.self_assessment && (
          <div>
            <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Self assessment</dt>
            <dd className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
              {(Object.keys(r.self_assessment) as (keyof typeof r.self_assessment)[]).map((key) => (
                <span key={key}>
                  {key}: {r.self_assessment![key]}
                  {r.extra.comparison_self_assessment && (
                    <span className="text-muted"> (30-day: {r.extra.comparison_self_assessment[key]})</span>
                  )}
                </span>
              ))}
            </dd>
          </div>
        )}

        {stepsStat.averageDailySteps !== null && (
          <div>
            <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Average daily steps</dt>
            <dd className="mt-0.5">
              {stepsStat.averageDailySteps.toLocaleString()} steps/day
              <span className="text-muted"> · over {stepsStat.daysLogged} logged days</span>
            </dd>
          </div>
        )}

        {habitSummary && (
          <div>
            <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Habit completion so far</dt>
            <dd className="mt-1 space-y-1">
              <p>
                Morning Routine: {habitSummary.morning_completed}/{habitSummary.morning_eligible} days
              </p>
              <p>
                Night Routine: {habitSummary.night_completed}/{habitSummary.night_eligible} days
              </p>
              <p>
                Themed check-ins: {habitSummary.themed_completed}/{habitSummary.themed_eligible}
              </p>
            </dd>
          </div>
        )}

        <Field label="Focus for the next 30 days" value={r.focus_next_period} />

        {r.commitment_signed_name && (
          <Field
            label="Commitment"
            value={`Signed by ${r.commitment_signed_name} on ${r.commitment_signed_date}`}
          />
        )}
      </dl>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
