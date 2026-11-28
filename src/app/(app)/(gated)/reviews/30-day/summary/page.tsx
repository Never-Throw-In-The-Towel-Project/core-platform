import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getRecentSteps } from "@/lib/steps/queries";
import { stepsStatForRange } from "@/lib/steps/reviewStats";
import { PrintButton } from "@/components/PrintButton";
import type { PeriodicReview } from "@/types/database";

/**
 * The read-only "read it back" view My Journey's milestones card links to
 * once the 30-Day Review is done -- same pattern as the 90-day summary
 * (src/app/(app)/reviews/90-day/summary/page.tsx), simplified since the
 * 30-day review has no quarter-specific extras (habit summary, comparison
 * scores) to show.
 */
export default async function ThirtyDaySummaryPage() {
  const profile = await getProfile();

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  // Treated the same as "no review" below, since either way there's
  // nothing to safely render on this read-back page.
  let review: PeriodicReview | null = null;
  try {
    const supabase = await createClient("private");
    const { data } = await supabase
      .from("periodic_reviews")
      .select("*")
      .eq("user_id", profile.id)
      .eq("review_type", "30_day")
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

  // Average daily steps across the review period (brief §1) -- a purely
  // personal progress metric, read only from the member's own private
  // step_entries and shown to no one else. Best-effort: any failure, or a
  // member who never logged steps, simply hides the block (steps are optional
  // and no one is ever penalised for not tracking).
  let stepsStat = { daysLogged: 0, averageDailySteps: null as number | null };
  try {
    const supabase = await createClient("private");
    const entries = await getRecentSteps(supabase, profile.id, r.period_start);
    stepsStat = stepsStatForRange(entries, r.period_start, r.period_end);
  } catch {
    // leave the zero/null default -> block hidden
  }

  return (
    // Dark "ink" surface on screen, matching the Today board (print stays on
    // white paper via the print: overrides). Full-width wrapper carries the
    // scope + ground paint; the <main> stays the centered column.
    <div data-surface="ink" className="min-h-full bg-background text-foreground print:bg-transparent">
    <main className="mx-auto max-w-xl px-6 py-12 print:text-black">
      <Link href="/journey" className="mb-4 inline-block text-sm text-muted hover:text-foreground print:hidden">
        ← My Journey
      </Link>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">30-Day Summary</h1>
        <PrintButton />
      </div>

      <dl className="space-y-4 text-sm">
        <Field label="Period" value={`${r.period_start} to ${r.period_end}`} />
        <Field label="Most proud of" value={r.most_proud_of} />
        <Field label="Most consistent habits" value={r.most_consistent_habits} />
        <Field label="Challenges faced" value={r.challenges_faced} />
        <Field label="What's working" value={r.whats_working} />
        <Field label="What needs to change" value={r.needs_to_change} />
        {r.top_wins.length > 0 && <Field label="Top wins" value={r.top_wins.join(" · ")} />}

        {stepsStat.averageDailySteps !== null && (
          <div>
            <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Average daily steps</dt>
            <dd className="mt-0.5">
              {stepsStat.averageDailySteps.toLocaleString()} steps/day
              <span className="text-muted"> · over {stepsStat.daysLogged} logged days</span>
            </dd>
          </div>
        )}

        {r.self_assessment && (
          <div>
            <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Self assessment</dt>
            <dd className="mt-1 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
              {(Object.keys(r.self_assessment) as (keyof typeof r.self_assessment)[]).map((key) => (
                <span key={key}>
                  {key}: {r.self_assessment![key]}
                </span>
              ))}
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
    </div>
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
