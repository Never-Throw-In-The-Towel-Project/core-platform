import { requireHrAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  computeTrendDelta,
  getReviewCompletions,
  getSupportCount,
  getWeekdayEngagementForWeek,
  getWeeklyParticipation,
} from "@/lib/dashboard/aggregates";
import { getMondayOfWeek, todayISODate } from "@/lib/routines/dates";
import { getAdminChallengeView, type AdminChallengeView } from "@/lib/steps/challengeQueries";
import { InviteEmployeeForm } from "@/components/admin/InviteEmployeeForm";
import { ChallengeSetupForm } from "@/components/admin/ChallengeSetupForm";
import { ChallengeAdminTile } from "@/components/admin/ChallengeAdminTile";
import type { Weekday } from "@/types/database";

const WEEKDAY_LABEL: Record<Weekday, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
};

function overallPercent(week: { morningPercent: number | null; nightPercent: number | null; themedPercent: number | null }): number | null {
  const values = [week.morningPercent, week.nightPercent, week.themedPercent].filter(
    (v): v is number => v !== null
  );
  return values.length > 0 ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : null;
}

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
  const currentWeekMonday = getMondayOfWeek(new Date(), "UTC");

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  // Degrading to the same "Not enough data yet" empty states this
  // dashboard already renders is safer than crashing an HR admin's whole
  // reporting screen.
  let company: { name: string } | null = null;
  let supportCount: Awaited<ReturnType<typeof getSupportCount>> = 0;
  let reviewCompletions: Awaited<ReturnType<typeof getReviewCompletions>> = [];
  let weeklyParticipation: Awaited<ReturnType<typeof getWeeklyParticipation>> = [];
  let weekdayThisWeek: Awaited<ReturnType<typeof getWeekdayEngagementForWeek>> = [];
  try {
    const supabase = await createClient();
    const [companyResult, supportCountResult, reviewCompletionsResult, weeklyParticipationResult, weekdayThisWeekResult] =
      await Promise.all([
        supabase.from("companies").select("name").eq("id", profile.company_id).maybeSingle(),
        getSupportCount(supabase, profile.company_id),
        getReviewCompletions(supabase, profile.company_id),
        getWeeklyParticipation(supabase, profile.company_id),
        getWeekdayEngagementForWeek(supabase, profile.company_id, currentWeekMonday),
      ]);
    company = companyResult.data;
    supportCount = supportCountResult;
    reviewCompletions = reviewCompletionsResult;
    weeklyParticipation = weeklyParticipationResult;
    weekdayThisWeek = weekdayThisWeekResult;
  } catch {
    company = null;
    supportCount = 0;
    reviewCompletions = [];
    weeklyParticipation = [];
    weekdayThisWeek = [];
  }

  // The company's active step challenge (aggregate only), if any. Best-effort:
  // any failure just falls back to offering the setup form.
  let adminChallenge: AdminChallengeView | null = null;
  try {
    const supabase = await createClient();
    adminChallenge = await getAdminChallengeView(supabase, profile.company_id);
  } catch {
    adminChallenge = null;
  }
  const todayIso = todayISODate(new Date(), "UTC");

  const latestWeek = weeklyParticipation[weeklyParticipation.length - 1] ?? null;
  const trendDelta = computeTrendDelta(weeklyParticipation);
  const thirtyDayReviews = reviewCompletions.find((r) => r.reviewType === "30_day");
  const ninetyDayReviews = reviewCompletions.find((r) => r.reviewType === "90_day");

  const engagedThisWeek = weekdayThisWeek.filter((w) => w.percent !== null);
  const mostEngaged = [...engagedThisWeek].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))[0];
  const leastEngaged = [...engagedThisWeek].sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))[0];

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-sm opacity-70">
        HR Admin · {company?.name ?? "Your company"}
        {latestWeek && ` · ${latestWeek.headcount} staff enrolled`}
      </p>

      <div className="mt-4 bg-brand-background px-4 py-3 text-sm text-brand-foreground">
        You see company-wide numbers only. No names, no answers, no individual scores — by design, and not
        configurable.
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi value={latestWeek?.themedPercent != null ? `${latestWeek.themedPercent}%` : "—"} label="Check-in completion this week" />
        <Kpi
          value={trendDelta ? `${trendDelta.points > 0 ? "+" : ""}${trendDelta.points}` : "—"}
          label={trendDelta ? `Points vs Week ${trendDelta.comparedToWeekNumber}` : "Not enough data yet"}
          accent={trendDelta ? trendDelta.points > 0 : false}
        />
        <Kpi value={String(supportCount)} label="Support button uses · count only" />
        <div className="border border-current/15 p-4">
          <p className="text-3xl font-extrabold">
            {thirtyDayReviews?.completedCount ?? 0}
            <span className="text-lg font-semibold opacity-50">
              {" / "}
              {ninetyDayReviews?.completedCount ?? 0}
            </span>
          </p>
          <p className="mt-1 text-xs uppercase opacity-60">30 / 90 day reviews completed</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
        <div>
          <p className="text-xs font-semibold tracking-wide uppercase opacity-60">
            Participation trend · {weeklyParticipation.length} weeks
          </p>
          {weeklyParticipation.length === 0 ? (
            <p className="mt-4 text-sm opacity-60">Not enough data yet.</p>
          ) : (
            <>
              <div className="mt-3 flex h-32 items-end gap-1">
                {weeklyParticipation.map((week, i) => (
                  <div
                    key={week.weekStartDate}
                    className={"flex-1 " + (i === weeklyParticipation.length - 1 ? "bg-brand-accent" : "bg-current/20")}
                    style={{ height: `${overallPercent(week) ?? 0}%` }}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-xs opacity-60">
                <span>Week {weeklyParticipation[0].weekNumber}</span>
                <span>Week {weeklyParticipation[weeklyParticipation.length - 1].weekNumber}</span>
              </div>
            </>
          )}

          <p className="mt-8 text-xs font-semibold tracking-wide uppercase opacity-60">Completion by day · this week</p>
          {engagedThisWeek.length === 0 ? (
            <p className="mt-3 text-sm opacity-60">Not enough data yet.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {weekdayThisWeek.map((day) => (
                <div key={day.weekday} className="flex items-center gap-3 text-sm">
                  <span className="w-20 shrink-0">{WEEKDAY_LABEL[day.weekday]}</span>
                  <div className="h-2 flex-1 bg-current/10">
                    <div className="h-full bg-brand-accent" style={{ width: `${day.percent ?? 0}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-right font-semibold">{day.percent ?? "—"}%</span>
                </div>
              ))}
              <p className="pt-1 text-xs opacity-60">
                Most engaged: {mostEngaged ? WEEKDAY_LABEL[mostEngaged.weekday] : "—"}. Least engaged:{" "}
                {leastEngaged ? WEEKDAY_LABEL[leastEngaged.weekday] : "—"}.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="border border-current/15 p-4 text-sm">
            <p className="font-semibold">90 Day Impact Report</p>
            <p className="mt-1 opacity-70">
              Board-ready PDF: participation, engagement trend, support usage, review completion. Auto-generates
              for each employee&apos;s 90-day mark, or download the company&apos;s current figures any time.
            </p>
            <a
              href="/api/reports/impact"
              className="mt-3 inline-block bg-brand-accent px-4 py-2 text-sm font-semibold text-brand-accent-foreground"
            >
              Download impact report
            </a>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-wide uppercase opacity-60">Not available to you</p>
            <ul className="mt-2 space-y-1 text-sm opacity-60">
              <li>Individual answers</li>
              <li>Sleep scores and day ratings</li>
              <li>Who used the support button</li>
              <li>Journal and review content</li>
              <li>Names against any figure</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-10 border-t border-current/10 pt-8">
        <p className="text-xs font-semibold tracking-wide uppercase opacity-60">Step challenge</p>
        <div className="mt-4">
          {adminChallenge ? (
            <ChallengeAdminTile view={adminChallenge} todayIso={todayIso} />
          ) : (
            <ChallengeSetupForm />
          )}
        </div>
      </div>

      <div className="mt-10 border-t border-current/10 pt-8">
        <InviteEmployeeForm />
      </div>
    </main>
  );
}

function Kpi({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="border border-current/15 p-4">
      <p className={"text-3xl font-extrabold " + (accent ? "text-brand-accent" : "")}>{value}</p>
      <p className="mt-1 text-xs uppercase opacity-60">{label}</p>
    </div>
  );
}
