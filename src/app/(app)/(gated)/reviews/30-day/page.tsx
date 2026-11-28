import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { getActiveDayCount } from "@/lib/routines/dayState";
import { getPendingPeriodicReview } from "@/lib/routines/periodicReview";
import { PeriodicReviewForm } from "@/components/routines/PeriodicReviewForm";

export default async function ThirtyDayReviewPage() {
  const profile = await getProfile();
  const activeDayCount = await getActiveDayCount(profile.id);
  const pending = await getPendingPeriodicReview(profile.id, activeDayCount);

  // Not guessable from the URL alone -- only reachable once actually due,
  // same accountability pattern as the rest of Phase 2/3.
  if (pending !== "30_day") {
    redirect("/home");
  }

  return (
    // Dark "ink" surface, matching the Today board. The form controls its own
    // full-width layout (incl. its red hero band, which stays red on ink).
    <main data-surface="ink" className="min-h-full bg-background text-foreground">
      <PeriodicReviewForm reviewType="30_day" />
    </main>
  );
}
