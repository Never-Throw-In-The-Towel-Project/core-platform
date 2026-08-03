import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  resolveHomePhase,
  getActiveDayCount,
  getThemedCheckinCompletionThisWeek,
  getOutstandingWeekdaysThisWeek,
  type HomePhase,
} from "@/lib/routines/dayState";
import { getPendingPeriodicReview } from "@/lib/routines/periodicReview";
import { getIsoWeekNumber, getMondayOfWeek, todayISODate, weekdayNameOrWeekend } from "@/lib/routines/dates";
import { CHECKIN_CONFIG } from "@/lib/routines/checkinConfig";
import type { Weekday } from "@/types/database";

const THEMED_TITLES: Record<Weekday, { title: string; subtitle: string }> = {
  ...CHECKIN_CONFIG,
  wednesday: { title: "Workout Wednesday", subtitle: "Move the body" },
};

const WEEKDAY_LABEL: Record<Weekday, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
};

const TRACKER_LETTERS: { key: Weekday | "saturday" | "sunday"; letter: string }[] = [
  { key: "monday", letter: "M" },
  { key: "tuesday", letter: "T" },
  { key: "wednesday", letter: "W" },
  { key: "thursday", letter: "T" },
  { key: "friday", letter: "F" },
  { key: "saturday", letter: "S" },
  { key: "sunday", letter: "S" },
];

const REVIEW_ROUTES = { "30_day": "/reviews/30-day", "90_day": "/reviews/90-day" } as const;

function formatHM(time: string | null): string {
  if (!time) return "";
  return time.slice(0, 5);
}

// The "Today" screen -- built as a Rail (see the conversation this shipped
// from): one focal card for whatever time-of-day window is currently open,
// with everything else -- the rest of today, this week's optional catch-up,
// the weekly tracker -- as a stack of rules below it, not competing for the
// same attention. Tapping the hero's CTA navigates out to a dedicated
// screen (/morning-routine, /night-routine, /checkin) rather than
// rendering the form inline, unlike the previous version of this page.
export default async function HomePage() {
  const profile = await getProfile();
  const activeDayCount = await getActiveDayCount(profile.id);

  // The 30/90-Day Review is "the critical retention point" / "triggers the
  // renewal conversation" per the brief -- it takes over the home screen
  // as a full-screen moment until completed, ahead of the normal Rail below.
  const pendingReview = await getPendingPeriodicReview(profile.id, activeDayCount);
  if (pendingReview) {
    redirect(REVIEW_ROUTES[pendingReview]);
  }

  const now = new Date();
  const phase = resolveHomePhase(now, profile.timezone);
  const todayWeekday = weekdayNameOrWeekend(now, profile.timezone);
  const isoWeek = getIsoWeekNumber(now, profile.timezone);
  const isWeekday = todayWeekday !== "saturday" && todayWeekday !== "sunday";
  const weeklyReviewOpen = todayWeekday === "friday" || todayWeekday === "saturday" || todayWeekday === "sunday";

  const privateClient = await createClient("private");
  const todayISO = todayISODate(now, profile.timezone);

  const [{ data: morningEntry }, { data: nightEntry }, completedWeekdays, mondayGoalsRow] = await Promise.all([
    privateClient.from("morning_entries").select("completed_at").eq("user_id", profile.id).eq("entry_date", todayISO).maybeSingle(),
    privateClient.from("night_entries").select("completed_at").eq("user_id", profile.id).eq("entry_date", todayISO).maybeSingle(),
    getThemedCheckinCompletionThisWeek(profile.id, now, profile.timezone),
    isWeekday
      ? privateClient
          .from("themed_checkins")
          .select("goals")
          .eq("user_id", profile.id)
          .eq("week_start_date", getMondayOfWeek(now, profile.timezone))
          .eq("weekday", "monday")
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const morningDone = Boolean(morningEntry?.completed_at);
  const nightDone = Boolean(nightEntry?.completed_at);
  const mondayGoalCount = ((mondayGoalsRow?.data?.goals as { goals?: string[] } | null)?.goals ?? []).length;

  const catchUp = isWeekday
    ? (await getOutstandingWeekdaysThisWeek(profile.id, now, profile.timezone)).filter((w) => w !== todayWeekday)
    : [];

  const isNight = phase.kind === "night";

  return (
    <main className={isNight ? "min-h-full bg-brand-background text-brand-foreground" : "min-h-full"}>
      <div className="mx-auto max-w-xl px-6 py-10">
        <div className="flex items-center justify-between text-xs opacity-70">
          <span>
            DAY {activeDayCount} · WEEK {isoWeek}
          </span>
          <span>
            {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: profile.timezone })} ·{" "}
            {todayWeekday.toUpperCase()}
          </span>
        </div>

        <HeroCard phase={phase} weeklyReviewOpen={weeklyReviewOpen} />

        <div className="mt-8 space-y-3">
          {phase.kind !== "morning" && (
            <StackRow
              label="Morning Routine"
              meta={morningDone ? "Win the morning, win the day" : "Not done yet"}
              time={morningDone ? "DONE" : formatHM(profile.morning_notification_time)}
              href="/morning-routine"
            />
          )}
          {isWeekday && phase.kind !== "themed" && (
            <StackRow
              label={THEMED_TITLES[todayWeekday as Weekday].title}
              meta={completedWeekdays.has(todayWeekday as Weekday) ? THEMED_TITLES[todayWeekday as Weekday].subtitle : "Not done yet"}
              time={completedWeekdays.has(todayWeekday as Weekday) ? "DONE" : "12:00"}
              href="/checkin"
            />
          )}
          {phase.kind !== "night" && (
            <StackRow
              label="Night Routine"
              meta={nightDone ? "Rest up and go again" : "Tomorrow is a new day"}
              time={nightDone ? "DONE" : formatHM(profile.night_notification_time)}
              href="/night-routine"
            />
          )}
          {mondayGoalCount > 0 && (
            <StackRow label="Monday's goals" meta="Reviewed Friday" time={`${mondayGoalCount} SET`} />
          )}
        </div>

        {catchUp.length > 0 && (
          <div className="mt-8">
            <p className="text-xs font-semibold tracking-wide uppercase opacity-60">Also open this week</p>
            <div className="mt-2 space-y-2">
              {catchUp.map((weekday) => (
                <Link
                  key={weekday}
                  href={`/checkin?day=${weekday}`}
                  className="block border border-current/10 px-4 py-2 text-sm underline opacity-80 hover:opacity-100"
                >
                  {THEMED_TITLES[weekday].title} — {WEEKDAY_LABEL[weekday]}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8">
          <p className="text-xs font-semibold tracking-wide uppercase opacity-60">This week</p>
          <div className="mt-2 flex gap-1">
            {TRACKER_LETTERS.map(({ key, letter }, i) => {
              const isToday = key === todayWeekday;
              const isDone = key !== "saturday" && key !== "sunday" && completedWeekdays.has(key);
              return (
                <span
                  key={`${key}-${i}`}
                  className={
                    "flex h-9 w-9 items-center justify-center border text-sm font-semibold " +
                    (isDone
                      ? "border-brand-accent bg-brand-accent text-brand-accent-foreground"
                      : isToday
                        ? "border-2 border-brand-accent"
                        : "border-current/15 opacity-50")
                  }
                >
                  {letter}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}

function HeroCard({
  phase,
  weeklyReviewOpen,
}: {
  phase: HomePhase;
  weeklyReviewOpen: boolean;
}) {
  if (phase.kind === "morning") {
    return (
      <Hero title="Morning Routine" subtitle="Win the morning, win the day." ctaLabel="Start morning routine" ctaHref="/morning-routine" />
    );
  }

  if (phase.kind === "night") {
    return (
      <Hero title="Night Routine" subtitle="Tomorrow is a new day, rest up and go again." ctaLabel="Start night routine" ctaHref="/night-routine" />
    );
  }

  if (phase.kind === "themed") {
    const info = THEMED_TITLES[phase.weekday];
    return (
      <div className="mt-6">
        <Hero title={info.title} subtitle={info.subtitle} ctaLabel="Open today's check-in" ctaHref="/checkin" />
        {weeklyReviewOpen && (
          <Link href="/weekly-review" className="mt-3 block text-sm underline opacity-80">
            Weekly Review is also open
          </Link>
        )}
      </div>
    );
  }

  // weekend_midday
  return (
    <div className="mt-6">
      <Hero title="Enjoy the weekend." subtitle="" ctaLabel="Weekly Review" ctaHref="/weekly-review" />
      {phase.isSunday && (
        <Link href="/sunday-setup" className="mt-3 block text-sm underline opacity-80">
          Sunday Setup
        </Link>
      )}
    </div>
  );
}

function Hero({
  title,
  subtitle,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="mt-6">
      <h1 className="text-3xl font-extrabold uppercase">{title}</h1>
      {subtitle && <p className="mt-2 opacity-80">{subtitle}</p>}
      <Link
        href={ctaHref}
        className="mt-6 block w-full bg-brand-accent px-5 py-3 text-center text-sm font-semibold text-brand-accent-foreground"
      >
        {ctaLabel} →
      </Link>
    </div>
  );
}

function StackRow({
  label,
  meta,
  time,
  href,
}: {
  label: string;
  meta: string;
  time: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-center justify-between border-t border-current/10 py-3 text-sm">
      <div>
        <p className="font-medium">{label}</p>
        <p className="opacity-60">{meta}</p>
      </div>
      <span className="font-semibold opacity-70">{time}</span>
    </div>
  );

  return href ? (
    <Link href={href} className="block hover:opacity-80">
      {content}
    </Link>
  ) : (
    content
  );
}
