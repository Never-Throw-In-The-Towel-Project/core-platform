import Link from "next/link";
import { getProfile } from "@/lib/auth/dal";
import { resolveHomePhase, getDayCounter } from "@/lib/routines/dayState";
import { MorningRoutineForm } from "@/components/routines/MorningRoutineForm";
import { NightRoutineForm } from "@/components/routines/NightRoutineForm";
import { CHECKIN_CONFIG, type TextCheckinWeekday } from "@/lib/routines/checkinConfig";

const THEMED_TITLES: Record<string, { title: string; subtitle: string }> = {
  ...CHECKIN_CONFIG,
  wednesday: { title: "Workout Wednesday", subtitle: "Move the body" },
};

export default async function HomePage() {
  const profile = await getProfile();
  const phase = resolveHomePhase();
  const { dayNumber } = await getDayCounter(profile.id);

  if (phase.kind === "morning") {
    return (
      <main className="mx-auto max-w-xl px-6 py-12">
        <MorningRoutineForm dayNumber={dayNumber} />
      </main>
    );
  }

  if (phase.kind === "night") {
    return (
      <main className="mx-auto max-w-xl px-6 py-12">
        <NightRoutineForm dayNumber={dayNumber} />
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
      </main>
    );
  }

  // weekend_midday -- Weekly Review is Phase 3 and isn't built yet, so
  // Saturday just gets a rest message; Sunday links to Sunday Setup.
  return (
    <main className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-2xl font-bold">Enjoy the weekend.</h1>
      {phase.isSunday && (
        <Link
          href="/sunday-setup"
          className="mt-6 inline-block rounded-md bg-brand-accent px-5 py-3 text-sm font-semibold text-white"
        >
          Sunday Setup
        </Link>
      )}
    </main>
  );
}
