import Link from "next/link";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { PeriodicReview, WeeklyReview } from "@/types/database";

// "My Journey" / "My History" -- per the brief's flag, Weekly Review and
// the 30/90-Day Reviews are a personal record the user can scroll back
// through over time, not just a one-time form. Read-only.
export default async function JourneyPage() {
  const profile = await getProfile();
  const supabase = await createClient();

  const [{ data: weeklyReviews }, { data: periodicReviews }] = await Promise.all([
    supabase
      .from("weekly_reviews")
      .select("*")
      .eq("user_id", profile.id)
      .not("completed_at", "is", null)
      .order("week_start_date", { ascending: false }),
    supabase
      .from("periodic_reviews")
      .select("*")
      .eq("user_id", profile.id)
      .not("completed_at", "is", null)
      .order("period_end", { ascending: false }),
  ]);

  const hasHistory = (weeklyReviews?.length ?? 0) > 0 || (periodicReviews?.length ?? 0) > 0;

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-2xl font-bold">My Journey</h1>
      <p className="mt-1 opacity-80">Look back over your reviews, whenever you want.</p>

      {!hasHistory && <p className="mt-8 text-sm opacity-70">Nothing here yet -- keep going.</p>}

      {(periodicReviews as PeriodicReview[] | null)?.map((review) => (
        <details key={review.id} className="mt-4 rounded-lg border border-white/10 p-4">
          <summary className="cursor-pointer text-sm font-medium">
            {review.review_type === "90_day" ? "90-Day Review" : "30-Day Review"} -- {review.period_end}
          </summary>
          <div className="mt-3 space-y-2 text-sm opacity-80">
            {review.most_proud_of && <p>Most proud of: {review.most_proud_of}</p>}
            {review.top_wins.length > 0 && <p>Top wins: {review.top_wins.join(", ")}</p>}
            {review.focus_next_period && <p>Focus ahead: {review.focus_next_period}</p>}
            {review.review_type === "90_day" && (
              <Link href="/reviews/90-day/summary" className="inline-block underline">
                View full summary / download
              </Link>
            )}
          </div>
        </details>
      ))}

      {(weeklyReviews as WeeklyReview[] | null)?.map((review) => (
        <details key={review.id} className="mt-4 rounded-lg border border-white/10 p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Weekly Review -- week of {review.week_start_date}
          </summary>
          <div className="mt-3 space-y-2 text-sm opacity-80">
            {review.habits_served_well && <p>Habits that served me well: {review.habits_served_well}</p>}
            {review.lessons_learned && <p>Lessons learned: {review.lessons_learned}</p>}
            {review.habits_to_double_down && <p>Doubling down on: {review.habits_to_double_down}</p>}
          </div>
        </details>
      ))}
    </main>
  );
}
