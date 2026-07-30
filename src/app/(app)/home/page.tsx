import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { resolveHomePhase, getActiveDayCount } from "@/lib/routines/dayState";
import { getPendingPeriodicReview } from "@/lib/routines/periodicReview";
import { weekdayNameOrWeekend } from "@/lib/routines/dates";
import { MorningRoutineForm } from "@/components/routines/MorningRoutineForm";
import { NightRoutineForm } from "@/components/routines/NightRoutineForm";
import { CHECKIN_CONFIG, type TextCheckinWeekday } from "@/lib/routines/checkinConfig";

const THEMED_TITLES: Record<string, { title: string; subtitle: string }> = {
  ...CHECKIN_CONFIG,
  wednesday: { title: "Workout Wednesday", subtitle: "Move the body" },
};

const REVIEW_ROUTES = { "30_day": "/reviews/30-day", "90_day": "/reviews/90-day" } as const;

export default async function HomePage() {
  const profile = await getProfile();
  const activeDayCount = await getActiveDayCount(profile.id);

  // The 30/90-Day Review is "the critical retention point" / "triggers the
  // renewal conversation" per the brief -- it takes over the home screen
  // as a full-screen moment until completed, ahead of the normal
  // morning/themed/night dispatch below.
  const pendingReview = await getPendingPeriodicReview(profile.id, activeDayCount);
  if (pendingReview) {
    redirect(REVIEW_ROUTES[pendingReview]);
  }

  const phase = resolveHomePhase();
  const weekday = weekdayNameOrWeekend(new Date());
  const weeklyReviewOpen = weekday === "friday" || weekday === "saturday" || weekday === "sunday";

  if (phase.kind === "morning") {
    return (
      <main className="mx-auto max-w-xl px-6 py-12">
        <MorningRoutineForm />
      </main>
    );
  }

  if (phase.kind === "night") {
    return (
      <main className="mx-auto max-w-xl px-6 py-12">
        <NightRoutineForm />
      </main>
    );
  }

  if (phase.kind === "themed") {
    const info = THEMED_TITLES[phase.weekday as TextCheckinWeekday] ?? THEMED_TITLES[phase.weekday];
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="text-sm uppercase tracking-wide opacity-70">Today</p>
        <h1 className="mt-1 text-2xl font-bold">{info.title}</h1>
        <p className="mt-1 opacity-80">{info.subtitle}</p>
        <Link
          href="/checkin"
          className="mt-6 inline-block rounded-md bg-brand-accent px-5 py-3 text-sm font-semibold text-white"
        >
          Open today&apos;s check-in
        </Link>
        {weeklyReviewOpen && (
          <Link href="/weekly-review" className="mt-4 block text-sm underline opacity-80">
            Weekly Review is also open
          </Link>
        )}
      </main>
    );
  }

  // weekend_midday
  return (
    <main className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-2xl font-bold">Enjoy the weekend.</h1>
      <div className="mt-6 flex flex-col items-center gap-3">
        <Link
          href="/weekly-review"
          className="inline-block rounded-md bg-brand-accent px-5 py-3 text-sm font-semibold text-white"
        >
          Weekly Review
        </Link>
        {phase.isSunday && (
          <Link href="/sunday-setup" className="text-sm underline opacity-80">
            Sunday Setup
          </Link>
        )}
      </div>
    </main>
  );
}
