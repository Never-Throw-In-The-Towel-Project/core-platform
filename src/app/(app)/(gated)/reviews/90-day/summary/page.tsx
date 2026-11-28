import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getRecentSteps } from "@/lib/steps/queries";
import { stepsStatForRange, addDaysIso } from "@/lib/steps/reviewStats";
import { PrintButton } from "@/components/PrintButton";
import type { PeriodicReview } from "@/types/database";

/**
 * "User can download or share their 90 day summary (PDF export option)."
 * Implemented as a print-friendly page (browser "Save as PDF") rather than
 * server-side PDF generation -- this is the user's own on-demand summary,
 * not the unattended, auto-emailed HR impact report from Phase 6, which
 * genuinely needs a server-side PDF pipeline. Revisit if this one needs to
 * be generated/emailed without the user present.
 */
export default async function NinetyDaySummaryPage() {
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
      .eq("review_type", "90_day")
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

  // Average daily steps across the quarter, with a first-30-days comparison so
  // the member sees physical progress "alongside mindset progress" (brief §1) --
  // mirroring how the self-assessment shows the 90-day scores against the 30-day
  // ones. All read only from the member's own private step_entries; shown to no
  // one else. Best-effort: any failure, or a member who never logged, hides it.
  let quarterSteps = { daysLogged: 0, averageDailySteps: null as number | null };
  let firstMonthSteps = { daysLogged: 0, averageDailySteps: null as number | null };
  try {
    const supabase = await createClient("private");
    const entries = await getRecentSteps(supabase, profile.id, r.period_start);
    quarterSteps = stepsStatForRange(entries, r.period_start, r.period_end);
    // The first 30 days of the review period ~= the 30-day-review window.
    firstMonthSteps = stepsStatForRange(entries, r.period_start, addDaysIso(r.period_start, 29));
  } catch {
    // leave zero/null defaults -> block hidden
  }
  const stepsDelta =
    quarterSteps.averageDailySteps !== null && firstMonthSteps.averageDailySteps !== null
      ? quarterSteps.averageDailySteps - firstMonthSteps.averageDailySteps
      : null;

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
        <h1 className="text-3xl font-extrabold tracking-tight">90-Day Summary</h1>
        <PrintButton />
      </div>

      <dl className="space-y-4 text-sm">
        <Field label="Period" value={`${r.period_start} to ${r.period_end}`} />
        <Field label="Most proud of" value={r.most_proud_of} />
        <Field label="Most consistent habits" value={r.most_consistent_habits} />
        <Field label="Challenges faced" value={r.challenges_faced} />
        <Field label="What's working" value={r.whats_working} />
        <Field label="What needs to change" value={r.needs_to_change} />
        {r.extra.life_changes && <Field label="What's changed" value={r.extra.life_changes} />}
        {r.extra.next_period_vision && (
          <Field label="Vision for the next 90 days" value={r.extra.next_period_vision} />
        )}
        {r.top_wins.length > 0 && <Field label="Top wins" value={r.top_wins.join(" · ")} />}

        {r.self_assessment && (
          <div>
            <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Self assessment</dt>
            <dd className="mt-1 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
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

        {quarterSteps.averageDailySteps !== null && (
          <div>
            <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Average daily steps</dt>
            <dd className="mt-0.5">
              <p>
                This quarter: {quarterSteps.averageDailySteps.toLocaleString()} steps/day
                <span className="text-muted"> · over {quarterSteps.daysLogged} logged days</span>
              </p>
              {firstMonthSteps.averageDailySteps !== null && (
                <p className="mt-0.5">
                  First 30 days: {firstMonthSteps.averageDailySteps.toLocaleString()} steps/day
                  {stepsDelta !== null && stepsDelta !== 0 && (
                    <span className="text-muted">
                      {" "}
                      · {stepsDelta > 0 ? "up" : "down"} {Math.abs(stepsDelta).toLocaleString()}/day across the quarter
                    </span>
                  )}
                </p>
              )}
            </dd>
          </div>
        )}

        {habitSummary && (
          <div>
            <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Habit completion over the quarter</dt>
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
