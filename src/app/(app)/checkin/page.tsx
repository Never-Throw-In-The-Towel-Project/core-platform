import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  catchUpEligibleWeekdays,
  getMondayOfWeek,
  isFirstOccurrenceOfWeekdayInMonth,
  weekdayNameOrWeekend,
} from "@/lib/routines/dates";
import { getDailyQuote, getWorkoutForWeek } from "@/lib/routines/workouts";
import { ThemedCheckinForm } from "@/components/routines/ThemedCheckinForm";
import { WorkoutWednesdayForm } from "@/components/routines/WorkoutWednesdayForm";
import type { TextCheckinWeekday } from "@/lib/routines/checkinConfig";
import type { Weekday, WorkoutTier } from "@/types/database";

// The screen the Rail's hero card (today's own check-in) and its optional
// this-week catch-up list (see src/app/(app)/home/page.tsx) both open into.
// `day` selects which weekday's check-in to show -- defaults to today, but
// per docs/ARCHITECTURE.md "Daily core loop" (revised from the original
// no-backfill design) any weekday that's genuinely opened in the real
// current week is reachable, not just today. catchUpEligibleWeekdays is the
// single source of that validation, shared with the server action itself
// (src/lib/actions/themedCheckin.ts) -- a client can't request a future day
// or a different week by tampering with the query string any more than it
// could by tampering with the submitted form.
export default async function CheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { day } = await searchParams;
  const profile = await getProfile();
  const now = new Date();
  const eligible = catchUpEligibleWeekdays(now, profile.timezone);
  const today = weekdayNameOrWeekend(now, profile.timezone);

  const weekday = (day && eligible.includes(day as Weekday) ? day : today) as Weekday | "saturday" | "sunday";

  if (weekday === "saturday" || weekday === "sunday") {
    redirect("/home");
  }

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  // Falling back to null lets renderCheckin degrade to the form's own
  // empty-defaults state (no last-picked tier, no Monday goals to show)
  // rather than crashing this page.
  let privateClient: Awaited<ReturnType<typeof createClient>> | null = null;
  try {
    privateClient = await createClient("private");
  } catch {
    privateClient = null;
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <Link href="/home" className="mb-6 inline-block text-sm opacity-70 hover:opacity-100">
        ← Today
      </Link>
      {await renderCheckin(weekday, profile.id, profile.timezone, now, privateClient)}
    </main>
  );
}

async function renderCheckin(
  weekday: TextCheckinWeekday | "wednesday",
  userId: string,
  timezone: string,
  now: Date,
  privateClient: Awaited<ReturnType<typeof createClient>> | null
) {
  if (weekday === "wednesday") {
    const { data: lastWednesday } = privateClient
      ? await privateClient
          .from("themed_checkins")
          .select("answers")
          .eq("user_id", userId)
          .eq("weekday", "wednesday")
          .order("week_start_date", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    const defaultTier = ((lastWednesday?.answers as { tier?: string } | null)?.tier ?? null) as
      | WorkoutTier
      | null;
    const workout = await getWorkoutForWeek(now);

    return <WorkoutWednesdayForm workout={workout} defaultTier={defaultTier} />;
  }

  if (weekday === "thursday") {
    const quote = await getDailyQuote(now);
    return <ThemedCheckinForm weekday="thursday" quote={quote} />;
  }

  if (weekday === "friday") {
    const { data: mondayRow } = privateClient
      ? await privateClient
          .from("themed_checkins")
          .select("goals")
          .eq("user_id", userId)
          .eq("week_start_date", getMondayOfWeek(now, timezone))
          .eq("weekday", "monday")
          .maybeSingle()
      : { data: null };

    const mondayGoals = (mondayRow?.goals as { goals?: string[] } | null)?.goals ?? [];

    return <ThemedCheckinForm weekday="friday" mondayGoals={mondayGoals} />;
  }

  if (weekday === "tuesday") {
    let podcastEpisode = null;
    if (isFirstOccurrenceOfWeekdayInMonth(now, timezone, "tuesday")) {
      try {
        const publicClient = await createClient();
        const { data } = await publicClient
          .from("podcast_episodes")
          .select("title, embed_url")
          .order("release_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        podcastEpisode = data;
      } catch {
        podcastEpisode = null;
      }
    }

    return <ThemedCheckinForm weekday="tuesday" podcastEpisode={podcastEpisode} />;
  }

  return <ThemedCheckinForm weekday="monday" />;
}
