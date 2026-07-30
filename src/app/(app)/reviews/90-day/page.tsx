import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getDayCounter } from "@/lib/routines/dayState";
import { getPendingPeriodicReview } from "@/lib/routines/periodicReview";
import { PeriodicReviewForm } from "@/components/routines/PeriodicReviewForm";
import type { SelfAssessment } from "@/types/database";

export default async function NinetyDayReviewPage() {
  const profile = await getProfile();
  const { completedDays } = await getDayCounter(profile.id);
  const pending = await getPendingPeriodicReview(profile.id, completedDays);

  if (pending !== "90_day") {
    redirect("/home");
  }

  const supabase = await createClient("private");
  const { data: thirtyDayReview } = await supabase
    .from("periodic_reviews")
    .select("self_assessment")
    .eq("user_id", profile.id)
    .eq("review_type", "30_day")
    .not("completed_at", "is", null)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <PeriodicReviewForm
        reviewType="90_day"
        comparisonSelfAssessment={(thirtyDayReview?.self_assessment as SelfAssessment | null) ?? null}
      />
    </main>
  );
}
