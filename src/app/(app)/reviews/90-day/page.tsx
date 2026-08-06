import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getActiveDayCount } from "@/lib/routines/dayState";
import { getPendingPeriodicReview } from "@/lib/routines/periodicReview";
import { PeriodicReviewForm } from "@/components/routines/PeriodicReviewForm";
import type { SelfAssessment } from "@/types/database";

export default async function NinetyDayReviewPage() {
  const profile = await getProfile();
  const activeDayCount = await getActiveDayCount(profile.id);
  const pending = await getPendingPeriodicReview(profile.id, activeDayCount);

  if (pending !== "90_day") {
    redirect("/home");
  }

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  // A null comparison score just means the form renders without the
  // 30-day comparison column, same as a user who has no 30-day review to
  // compare against, not a crash on this milestone screen.
  let thirtyDayReview: { self_assessment: SelfAssessment | null } | null = null;
  try {
    const supabase = await createClient("private");
    const { data } = await supabase
      .from("periodic_reviews")
      .select("self_assessment")
      .eq("user_id", profile.id)
      .eq("review_type", "30_day")
      .not("completed_at", "is", null)
      .maybeSingle();
    thirtyDayReview = data;
  } catch {
    thirtyDayReview = null;
  }

  return (
    <main>
      <PeriodicReviewForm
        reviewType="90_day"
        comparisonSelfAssessment={(thirtyDayReview?.self_assessment as SelfAssessment | null) ?? null}
      />
    </main>
  );
}
