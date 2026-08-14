import { requireHrAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  computeTrendDelta,
  getReviewCompletions,
  getSupportCount,
  getWeekdayEngagementForWeek,
  getWeeklyParticipation,
} from "@/lib/dashboard/aggregates";
import { getMondayOfWeek } from "@/lib/routines/dates";
import type { Weekday } from "@/types/database";

const WEEKDAY_LABEL: Record<Weekday, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
};

function overallPercent(week: { morningPercent: number | null; nightPercent: number | null; themedPercent: number | null }): number | null {
  const values = [week.morningPercent, week.nightPercent, week.themedPercent].filter((v): v is number => v !== null);
  return values.length > 0 ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : null;
}

/**
 * Workspace › Overview -- the aggregate reporting: % completed by day/week,
 * most/least engaged weekday, participation trend, support usage, 30/90-day
 * review completion. Every number comes from the public company_* aggregate
 * tables; nothing here (or anywhere under (company)) reads the private schema.
 */
export default async function WorkspaceOverviewPage() {
  const profile = await requireHrAdmin();
  const currentWeekMonday = getMondayOfWeek(new Date(), "UTC");

  // Wrapped in try/catch: createClient() throws synchronously on a missing/bad
  // URL/key -- degrade to the same "Not enough data yet" empty states this
  // dashboard already renders rather than crashing HR's reporting.
  let supportCount: Awaited<ReturnType<typeof getSupportCount>> = 0;
  let reviewCompletions: Awaited<ReturnType<typeof getReviewCompletions>> = [];
  let weeklyParticipation: Awaited<ReturnType<typeof getWeeklyParticipation>> = [];
  let weekdayThisWeek: Awaited<ReturnType<typeof getWeekdayEngagementForWeek>> = [];
  try {
    const supabase = await createClient();
    const [supportCountResult, reviewCompletionsResult, weeklyParticipationResult, weekdayThisWeekResult] =
      await Promise.all([
        getSupportCount(supabase, profile.company_id),
        getReviewCompletions(supabase, profile.company_id),
        getWeeklyParticipation(supabase, profile.company_id),
        getWeekdayEngagementForWeek(supabase, profile.company_id, currentWeekMonday),
      ]);
    supportCount = supportCountResult;
    reviewCompletions = reviewCompletionsResult;
    weeklyParticipation = weeklyParticipationResult;
    weekdayThisWeek = weekdayThisWeekResult;
  } catch {
    supportCount = 0;
    reviewCompletions = [];
    weeklyParticipation = [];
    weekdayThisWeek = [];
  }

  const latestWeek = weeklyParticipation[weeklyParticipation.length - 1] ?? null;
  const trendDelta = computeTrendDelta(weeklyParticipation);
  const thirtyDayReviews = reviewCompletions.find((r) => r.reviewType === "30_day");
  const ninetyDayReviews = reviewCompletions.find((r) => r.reviewType === "90_day");

  const engagedThisWeek = weekdayThisWeek.filter((w) => w.percent !== null);
  const mostEngaged = [...engagedThisWeek].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))[0];
  const leastEngaged = [...engagedThisWeek].sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))[0];

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-sm opacity-70">{latestWeek ? `${latestWeek.headcount} staff enrolled` : "Company overview"}</p>

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

      <div className="mt-8">
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
