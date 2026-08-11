import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  resolveHomePhase,
  getThemedCheckinCompletionThisWeek,
  getOutstandingWeekdaysThisWeek,
} from "@/lib/routines/dayState";
import { getPendingPeriodicReview } from "@/lib/routines/periodicReview";
import { getTodayStats } from "@/lib/gamification/todayStats";
import {
  getIsoWeekNumber,
  getMondayOfWeek,
  todayISODate,
  weekdayNameOrWeekend,
} from "@/lib/routines/dates";
import { CHECKIN_CONFIG, type TextCheckinWeekday } from "@/lib/routines/checkinConfig";
import type { Weekday } from "@/types/database";
import { ProgressBand } from "@/components/today/ProgressBand";
import type { Story } from "@/components/today/StoryRail";
import { CheckinCard } from "@/components/today/CheckinCard";
import { RoutineRow } from "@/components/today/RoutineRow";
import { CompanySlot } from "@/components/today/CompanySlot";
import { WeekStrip } from "@/components/today/WeekStrip";
import { BadgeGrid } from "@/components/today/BadgeGrid";
import { WinsBoard } from "@/components/today/WinsBoard";
import { ReviewProgress } from "@/components/today/ReviewProgress";

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

const REVIEW_ROUTES = { "30_day": "/reviews/30-day", "90_day": "/reviews/90-day" } as const;

// The story rail reuses the photography already committed under public/site
// (the same shots the handoff renamed into designs/assets). Seen-state and the
// full-screen viewer aren't built yet (open decision) -- see StoryRail.
const STORIES: Story[] = [
  { key: "anthony", label: "Anthony", image: "/site/founder-speaking.jpg", seen: false },
  { key: "barbershop", label: "Barbershop", image: "/site/community-brotherhood.jpg", seen: false },
  { key: "meetup", label: "Meet-up", image: "/site/community-group.jpg", seen: true },
  { key: "episode", label: "Episode", image: "/site/podcast-recording.jpg", seen: true },
];

const CHECKIN_IMAGE = "/site/community-group.jpg";

function formatHM(time: string | null): string {
  if (!time) return "";
  return time.slice(0, 5);
}

function formatClock(timestamp: string | null, timeZone: string): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

/** Count how many of a text weekday's prompts already have a non-empty answer. */
function countAnswered(weekday: TextCheckinWeekday, answers: Record<string, unknown> | null): number {
  if (!answers) return 0;
  return CHECKIN_CONFIG[weekday].fields.filter((field) => {
    const value = answers[field.key];
    return typeof value === "string" && value.trim().length > 0;
  }).length;
}

// The redesigned "Today": an ink progress band (ring, rank, streak/wins/badges,
// story rail) over a two-column body -- the phase-appropriate hero card, the
// day's routine status, the company slot, and a right rail (week strip, badges,
// wins board, review progress). Every gamification number is derived from the
// user's own engagement; nothing private is ever shown to anyone but them.
export default async function HomePage() {
  const profile = await getProfile();
  const now = new Date();
  const timeZone = profile.timezone;

  const stats = await getTodayStats(profile.id, now, timeZone);

  // The 30/90-Day Review takes over the home screen as a full-screen moment
  // until completed (see the brief) -- checked before rendering the Rail.
  const pendingReview = await getPendingPeriodicReview(profile.id, stats.activeDayCount);
  if (pendingReview) {
    redirect(REVIEW_ROUTES[pendingReview]);
  }

  const phase = resolveHomePhase(now, timeZone);
  const todayWeekday = weekdayNameOrWeekend(now, timeZone);
  const isoWeek = getIsoWeekNumber(now, timeZone);
  const isWeekday = todayWeekday !== "saturday" && todayWeekday !== "sunday";
  const weeklyReviewOpen =
    todayWeekday === "friday" || todayWeekday === "saturday" || todayWeekday === "sunday";
  const mondayStart = getMondayOfWeek(now, timeZone);

  // Per-day routine + check-in status for the hero, routine rows and answered
  // count. Wrapped in try/catch: createClient() throws synchronously on a
  // missing/malformed URL/key -- /home is the universal landing page, so we
  // degrade to a safe "nothing done yet" rather than crashing it (same pattern
  // as lib/routines/*).
  let morningDone = false;
  let nightDone = false;
  let morningTime = "";
  let nightTime = "";
  let sleepScore: number | null = null;
  let dayRating: number | null = null;
  let answeredToday = 0;
  let companyName = "NTITT";
  let companyMessage: string | null = null;
  let companySkin = "#ec3013";

  try {
    const privateClient = await createClient("private");
    const publicClient = await createClient();
    const todayISO = todayISODate(now, timeZone);

    const [{ data: morningEntry }, { data: nightEntry }, { data: todayCheckin }, { data: company }] =
      await Promise.all([
        privateClient
          .from("morning_entries")
          .select("completed_at, sleep_score")
          .eq("user_id", profile.id)
          .eq("entry_date", todayISO)
          .maybeSingle(),
        privateClient
          .from("night_entries")
          .select("completed_at, day_rating")
          .eq("user_id", profile.id)
          .eq("entry_date", todayISO)
          .maybeSingle(),
        isWeekday && todayWeekday !== "wednesday"
          ? privateClient
              .from("themed_checkins")
              .select("answers")
              .eq("user_id", profile.id)
              .eq("week_start_date", mondayStart)
              .eq("weekday", todayWeekday)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        publicClient
          .from("companies")
          .select("name, welcome_copy, primary_color")
          .eq("id", profile.company_id)
          .maybeSingle(),
      ]);

    morningDone = Boolean(morningEntry?.completed_at);
    nightDone = Boolean(nightEntry?.completed_at);
    morningTime = formatClock(morningEntry?.completed_at ?? null, timeZone);
    nightTime = formatClock(nightEntry?.completed_at ?? null, timeZone);
    sleepScore = (morningEntry?.sleep_score as number | null) ?? null;
    dayRating = (nightEntry?.day_rating as number | null) ?? null;
    if (isWeekday && todayWeekday !== "wednesday") {
      answeredToday = countAnswered(
        todayWeekday as TextCheckinWeekday,
        (todayCheckin?.answers as Record<string, unknown> | null) ?? null
      );
    }
    companyName = company?.name ?? "NTITT";
    companyMessage = (company?.welcome_copy as string | null) ?? null;
    companySkin = (company?.primary_color as string | null) ?? "#ec3013";
  } catch {
    // safe defaults above
  }

  const completedWeekdays = await getThemedCheckinCompletionThisWeek(profile.id, now, timeZone);
  const catchUp = isWeekday
    ? (await getOutstandingWeekdaysThisWeek(profile.id, now, timeZone)).filter((w) => w !== todayWeekday)
    : [];

  const hero = buildHero({
    phase,
    morningDone,
    nightDone,
    answeredToday,
  });

  // Which routine/check-in status rows to show below the hero: everything the
  // hero itself isn't. Ordered morning -> today's check-in -> night.
  const rows: RowSpec[] = [];
  if (phase.kind !== "morning") {
    rows.push({
      key: "morning",
      label: "Morning Routine",
      done: morningDone,
      href: "/morning-routine",
      meta: morningDone
        ? `Done${morningTime ? ` at ${morningTime}` : ""}${
            sleepScore != null ? ` · slept ${sleepScore}/10 · private to you` : ""
          }`
        : "Win the morning, win the day",
      trailing: morningDone ? "Edit" : formatHM(profile.morning_notification_time),
    });
  }
  if (isWeekday && phase.kind !== "themed") {
    const done = completedWeekdays.has(todayWeekday as Weekday);
    rows.push({
      key: "themed",
      label: THEMED_TITLES[todayWeekday as Weekday].title,
      done,
      href: "/checkin",
      meta: done ? "Done · win in the bank" : THEMED_TITLES[todayWeekday as Weekday].subtitle,
      trailing: done ? "Edit" : "12:00",
    });
  }
  if (phase.kind !== "night") {
    rows.push({
      key: "night",
      label: "Night Routine",
      done: nightDone,
      href: "/night-routine",
      meta: nightDone
        ? `Done${nightTime ? ` at ${nightTime}` : ""}${
            dayRating != null ? ` · felt ${dayRating}/10 · private to you` : ""
          }`
        : "Opens at 21:00 · tomorrow is a new day",
      trailing: nightDone ? "Edit" : formatHM(profile.night_notification_time),
    });
  }

  return (
    <main className="min-h-full">
      <ProgressBand
        ringPct={stats.ringPct}
        rank={stats.rank}
        streak={stats.streak}
        winsCount={stats.winsCount}
        badgesEarned={stats.badgesEarned}
        daysToReview={stats.daysToReview}
        reviewLabel={stats.reviewLabel}
        reviewComplete={stats.reviewComplete}
        stories={STORIES}
      />

      <div className="mx-auto max-w-5xl px-5 py-6">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
          Day {stats.activeDayCount} · Week {isoWeek}
        </p>

        <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* Main column */}
          <div className="space-y-6">
            <CheckinCard
              headerLabel={hero.headerLabel}
              title={hero.title}
              description={hero.description}
              ctaLabel={hero.ctaLabel}
              ctaHref={hero.ctaHref}
              answered={hero.answered}
              total={hero.total}
              image={hero.image}
            />

            {hero.extraLink && (
              <Link href={hero.extraLink.href} className="block text-sm font-semibold text-brand-accent-deep underline">
                {hero.extraLink.label}
              </Link>
            )}

            {rows.length > 0 && (
              <div>
                {rows.map((row) => (
                  <RoutineRow
                    key={row.key}
                    label={row.label}
                    meta={row.meta}
                    done={row.done}
                    href={row.href}
                    trailing={row.trailing || undefined}
                  />
                ))}
              </div>
            )}

            {catchUp.length > 0 && (
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
                  Also open this week
                </p>
                <div className="mt-2 space-y-2">
                  {catchUp.map((weekday) => (
                    <Link
                      key={weekday}
                      href={`/checkin?day=${weekday}`}
                      className="block border border-rule-hairline px-4 py-2 text-sm hover:bg-foreground/[0.03]"
                    >
                      <span className="font-semibold">{THEMED_TITLES[weekday].title}</span>{" "}
                      <span className="text-muted">— {WEEKDAY_LABEL[weekday]}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <CompanySlot companyName={companyName} message={companyMessage} skinColor={companySkin} />
          </div>

          {/* Right rail (desktop) / stacked below (mobile) */}
          <aside className="space-y-6">
            <section>
              <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">The Week</h2>
              <div className="mt-2">
                <WeekStrip completedWeekdays={completedWeekdays} todayKey={todayWeekday} />
              </div>
            </section>

            <section>
              <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Badges</h2>
              <div className="mt-2">
                <BadgeGrid badges={stats.badges} />
              </div>
            </section>

            <section>
              <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Wins Board</h2>
              <div className="mt-2">
                <WinsBoard wins={stats.recentWins} />
              </div>
            </section>

            <ReviewProgress
              pct={stats.ringPct}
              daysToReview={stats.daysToReview}
              reviewLabel={stats.reviewLabel}
              reviewComplete={stats.reviewComplete}
            />

            {weeklyReviewOpen && (
              <Link href="/weekly-review" className="block text-sm font-semibold text-brand-accent-deep underline">
                Weekly Review is open →
              </Link>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

interface RowSpec {
  key: string;
  label: string;
  meta: string;
  done: boolean;
  href: string;
  trailing: string;
}

interface HeroSpec {
  headerLabel: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  answered?: number;
  total?: number;
  image?: string;
  extraLink?: { href: string; label: string };
}

/** Map the time-of-day phase to the focal hero card's content. */
function buildHero({
  phase,
  morningDone,
  nightDone,
  answeredToday,
}: {
  phase: ReturnType<typeof resolveHomePhase>;
  morningDone: boolean;
  nightDone: boolean;
  answeredToday: number;
}): HeroSpec {
  if (phase.kind === "morning") {
    return {
      headerLabel: "Morning Routine · 5 min",
      title: "Win the morning",
      description: "Win the morning, win the day.",
      ctaLabel: morningDone ? "Review →" : "Start →",
      ctaHref: "/morning-routine",
    };
  }

  if (phase.kind === "night") {
    return {
      headerLabel: "Night Routine",
      title: "Close the day",
      description: "Tomorrow is a new day — rest up and go again.",
      ctaLabel: nightDone ? "Review →" : "Start →",
      ctaHref: "/night-routine",
    };
  }

  if (phase.kind === "themed") {
    const weekday = phase.weekday;
    if (weekday === "wednesday") {
      return {
        headerLabel: "Today's Check-in · Wednesday · Workout",
        title: "Workout Wednesday",
        description: "Move the body. Four rounds, four difficulty tiers.",
        ctaLabel: "Start →",
        ctaHref: "/checkin",
        image: CHECKIN_IMAGE,
      };
    }
    const config = CHECKIN_CONFIG[weekday];
    const total = config.fields.length;
    return {
      headerLabel: `Today's Check-in · ${WEEKDAY_LABEL[weekday]} · 5 min`,
      title: config.title,
      description: `${config.subtitle}. ${total} prompts, five minutes.`,
      ctaLabel: answeredToday > 0 ? "Carry on →" : "Start →",
      ctaHref: "/checkin",
      answered: answeredToday,
      total,
      image: CHECKIN_IMAGE,
    };
  }

  // weekend_midday
  return {
    headerLabel: "Weekend",
    title: "Enjoy the weekend.",
    description: "Close the loop when you're ready.",
    ctaLabel: "Weekly Review →",
    ctaHref: "/weekly-review",
    extraLink: phase.isSunday ? { href: "/sunday-setup", label: "Get set for Monday →" } : undefined,
  };
}
