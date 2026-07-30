import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { getDayCounter } from "@/lib/routines/dayState";
import { getPendingPeriodicReview } from "@/lib/routines/periodicReview";
import { PeriodicReviewForm } from "@/components/routines/PeriodicReviewForm";

export default async function ThirtyDayReviewPage() {
  const profile = await getProfile();
  const { completedDays } = await getDayCounter(profile.id);
  const pending = await getPendingPeriodicReview(profile.id, completedDays);

  // Not guessable from the URL alone -- only reachable once actually due,
  // same accountability pattern as the rest of Phase 2/3.
  if (pending !== "30_day") {
    redirect("/home");
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <PeriodicReviewForm reviewType="30_day" />
    </main>
  );
}
