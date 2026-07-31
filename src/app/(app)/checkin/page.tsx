import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getMondayOfWeek, isFirstOccurrenceOfWeekdayInMonth, weekdayNameOrWeekend } from "@/lib/routines/dates";
import { getDailyQuote, getWorkoutForWeek } from "@/lib/routines/workouts";
import { ThemedCheckinForm } from "@/components/routines/ThemedCheckinForm";
import { WorkoutWednesdayForm } from "@/components/routines/WorkoutWednesdayForm";
import type { WorkoutTier } from "@/types/database";

// The "main screen" the home page's themed-check-in card opens into (see
// src/app/(app)/home/page.tsx). Today's weekday is resolved server-side --
// there is no route param for "which day" because there's only ever one
// correct answer: today.
export default async function CheckinPage() {
  const profile = await getProfile();
  const now = new Date();
  const weekday = weekdayNameOrWeekend(now, profile.timezone);

  if (weekday === "saturday" || weekday === "sunday") {
    redirect("/home");
  }

  const privateClient = await createClient("private");

  if (weekday === "wednesday") {
    const { data: lastWednesday } = await privateClient
      .from("themed_checkins")
      .select("answers")
      .eq("user_id", profile.id)
      .eq("weekday", "wednesday")
      .order("week_start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const defaultTier = ((lastWednesday?.answers as { tier?: string } | null)?.tier ?? null) as
      | WorkoutTier
      | null;
    const workout = await getWorkoutForWeek(now);

    return (
      <main className="mx-auto max-w-xl px-6 py-12">
        <WorkoutWednesdayForm workout={workout} defaultTier={defaultTier} />
      </main>
    );
  }

  if (weekday === "thursday") {
    const quote = await getDailyQuote(now);
    return (
      <main className="mx-auto max-w-xl px-6 py-12">
        <ThemedCheckinForm weekday="thursday" quote={quote} />
      </main>
    );
  }

  if (weekday === "friday") {
    const { data: mondayRow } = await privateClient
      .from("themed_checkins")
      .select("goals")
      .eq("user_id", profile.id)
      .eq("week_start_date", getMondayOfWeek(now, profile.timezone))
      .eq("weekday", "monday")
      .maybeSingle();

    const mondayGoals = (mondayRow?.goals as { goals?: string[] } | null)?.goals ?? [];

    return (
      <main className="mx-auto max-w-xl px-6 py-12">
        <ThemedCheckinForm weekday="friday" mondayGoals={mondayGoals} />
      </main>
    );
  }

  if (weekday === "tuesday") {
    let podcastEpisode = null;
    if (isFirstOccurrenceOfWeekdayInMonth(now, profile.timezone, "tuesday")) {
      const publicClient = await createClient();
      const { data } = await publicClient
        .from("podcast_episodes")
        .select("title, embed_url")
        .order("release_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      podcastEpisode = data;
    }

    return (
      <main className="mx-auto max-w-xl px-6 py-12">
        <ThemedCheckinForm weekday="tuesday" podcastEpisode={podcastEpisode} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <ThemedCheckinForm weekday="monday" />
    </main>
  );
}
