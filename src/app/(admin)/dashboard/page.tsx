import { requireHrAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  computeOverallTrend,
  getReviewCompletions,
  getSupportCount,
  getWeekdayEngagement,
  getWeeklyParticipation,
} from "@/lib/dashboard/aggregates";
import { InviteEmployeeForm } from "@/components/admin/InviteEmployeeForm";

const TREND_LABEL: Record<string, string> = {
  rising: "Rising",
  falling: "Falling",
  steady: "Steady",
  not_enough_data: "Not enough data yet",
};

const WEEKDAY_LABEL: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
};

const REVIEW_LABEL: Record<string, string> = {
  "30_day": "30-Day Review",
  "90_day": "90-Day Review",
};

/**
 * Full aggregate reporting per the brief: % completed by day/week, most and
 * least engaged weekday, overall participation trend, support usage count,
 * 30/90-day review completion. Every number here comes from the public
 * aggregate tables (company_support_counts, company_daily_participation,
 * company_review_completions) -- see docs/ARCHITECTURE.md "Privacy
 * boundary". There is no query on this page, or anywhere under (admin),
 * that reaches into `private`.
 */
export default async function DashboardPage() {
  const profile = await requireHrAdmin();
  const supabase = await createClient();

  const [supportCount, reviewCompletions, weeklyParticipation, weekdayEngagement] = await Promise.all([
    getSupportCount(supabase, profile.company_id),
    getReviewCompletions(supabase, profile.company_id),
    getWeeklyParticipation(supabase, profile.company_id),
    getWeekdayEngagement(supabase, profile.company_id),
  ]);

  const trend = computeOverallTrend(weeklyParticipation);
  const engaged = weekdayEngagement.filter((w) => w.percent !== null);
  const mostEngaged = [...engaged].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))[0];
  const leastEngaged = [...engaged].sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))[0];

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Company Dashboard</h1>
        <a
          href="/api/reports/impact"
          className="rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-brand-accent-foreground"
        >
          Download impact report
        </a>
      </div>
      <p className="mt-2 text-sm text-brand-foreground/70">
        Aggregate, anonymised data only. No individual answers, names, or scores.
      </p>

      <div className="mt-8">
        <InviteEmployeeForm />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <Stat label="Participation trend" value={TREND_LABEL[trend]} />
        <Stat label="Ask for Support uses (all time)" value={String(supportCount)} />
      </div>

      <h2 className="mt-10 text-lg font-semibold">Review completion</h2>
      <div className="mt-3 space-y-2">
        {["30_day", "90_day"].map((type) => {
          const review = reviewCompletions.find((r) => r.reviewType === type);
          return (
            <div key={type} className="flex items-center justify-between rounded-lg border border-white/10 p-4 text-sm">
              <span>{REVIEW_LABEL[type]} completed</span>
              <span className="font-semibold">
                {review ? `${review.completedCount} of ${review.eligibleCount}` : "No data yet"}
              </span>
            </div>
          );
        })}
      </div>

      <h2 className="mt-10 text-lg font-semibold">Engagement by day</h2>
      {engaged.length === 0 ? (
        <p className="mt-3 text-sm opacity-60">Not enough data yet.</p>
      ) : (
        <div className="mt-3 space-y-2 text-sm">
          {mostEngaged && (
            <p>
              Most engaged: <span className="font-semibold">{WEEKDAY_LABEL[mostEngaged.weekday]}</span> (
              {mostEngaged.percent}%)
            </p>
          )}
          {leastEngaged && (
            <p>
              Least engaged: <span className="font-semibold">{WEEKDAY_LABEL[leastEngaged.weekday]}</span> (
              {leastEngaged.percent}%)
            </p>
          )}
          <div className="mt-2 space-y-2">
            {weekdayEngagement.map((day) => (
              <Bar key={day.weekday} label={WEEKDAY_LABEL[day.weekday]} percent={day.percent} />
            ))}
          </div>
        </div>
      )}

      <h2 className="mt-10 text-lg font-semibold">
        Weekly participation (most recent {weeklyParticipation.length} weeks)
      </h2>
      {weeklyParticipation.length === 0 ? (
        <p className="mt-3 text-sm opacity-60">Not enough data yet.</p>
      ) : (
        <div className="mt-3 space-y-4">
          {weeklyParticipation.map((week) => (
            <div key={week.weekStartDate} className="rounded-lg border border-white/10 p-4">
              <p className="text-sm font-medium">
                Week {week.weekNumber} <span className="font-normal opacity-50">({week.weekStartDate})</span>
              </p>
              <div className="mt-2 space-y-1.5">
                <Bar label="Morning" percent={week.morningPercent} />
                <Bar label="Night" percent={week.nightPercent} />
                <Bar label="Check-ins" percent={week.themedPercent} />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <dl className="rounded-lg border border-white/10 p-6">
      <dt className="text-sm opacity-70">{label}</dt>
      <dd className="text-2xl font-bold">{value}</dd>
    </dl>
  );
}

function Bar({ label, percent }: { label: string; percent: number | null }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-16 shrink-0 opacity-70">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-brand-accent"
          style={{ width: `${percent ?? 0}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right opacity-70">{percent ?? "—"}%</span>
    </div>
  );
}
