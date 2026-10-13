import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getMondayOfWeek, weekdayNameOrWeekend } from "@/lib/routines/dates";
import { toWeeklyReviewInitial, type WeeklyReviewInitial } from "@/lib/routines/checkinPrefill";
import { WeeklyReviewForm } from "@/components/routines/WeeklyReviewForm";

// "Best placed as a tab or section the user can access from Friday
// onwards through the weekend" -- a separate page from Feel Good Friday,
// not a replacement for it.
export default async function WeeklyReviewPage() {
  const profile = await getProfile();
  const now = new Date();
  const weekday = weekdayNameOrWeekend(now, profile.timezone);
  if (weekday !== "friday" && weekday !== "saturday" && weekday !== "sunday") {
    redirect("/home");
  }

  // Pre-fill this week's already-saved review so editing it across Fri/Sat/Sun
  // doesn't wipe what was saved earlier (finding E2). Best-effort: any failure
  // just renders a blank form.
  let initial: WeeklyReviewInitial = toWeeklyReviewInitial(null);
  try {
    const privateClient = await createClient("private");
    const { data } = await privateClient
      .from("weekly_reviews")
      .select(
        "habits_served_well, challenges_helped_grow, lessons_learned, challenges_overcome, feels_better_from_habits, one_thing_to_improve, habits_to_double_down"
      )
      .eq("user_id", profile.id)
      .eq("week_start_date", getMondayOfWeek(now, profile.timezone))
      .maybeSingle();
    initial = toWeeklyReviewInitial(data);
  } catch {
    initial = toWeeklyReviewInitial(null);
  }

  return (
    // Dark "ink" surface, matching the Today board (full-width wrapper carries
    // the scope + ground paint; the <main> stays the centered column).
    <div data-surface="ink" className="min-h-full bg-background text-foreground">
    <main className="mx-auto max-w-xl px-6 py-12">
      <Link href="/home" className="mb-6 inline-block text-sm text-muted hover:text-foreground">
        ← Today
      </Link>
      <WeeklyReviewForm initial={initial} />
    </main>
    </div>
  );
}
