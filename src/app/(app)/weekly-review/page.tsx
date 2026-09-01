import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { weekdayNameOrWeekend } from "@/lib/routines/dates";
import { WeeklyReviewForm } from "@/components/routines/WeeklyReviewForm";

// "Best placed as a tab or section the user can access from Friday
// onwards through the weekend" -- a separate page from Feel Good Friday,
// not a replacement for it.
export default async function WeeklyReviewPage() {
  const profile = await getProfile();
  const weekday = weekdayNameOrWeekend(new Date(), profile.timezone);
  if (weekday !== "friday" && weekday !== "saturday" && weekday !== "sunday") {
    redirect("/home");
  }

  return (
    // Dark "ink" surface, matching the Today board (full-width wrapper carries
    // the scope + ground paint; the <main> stays the centered column).
    <div data-surface="ink" className="min-h-full bg-background text-foreground">
    <main className="mx-auto max-w-xl px-6 py-12">
      <Link href="/home" className="mb-6 inline-block text-sm text-muted hover:text-foreground">
        ← Today
      </Link>
      <WeeklyReviewForm />
    </main>
    </div>
  );
}
