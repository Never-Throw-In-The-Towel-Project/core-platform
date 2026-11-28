import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getMondayOfWeek, weekdayNameOrWeekend } from "@/lib/routines/dates";
import { toWeeklyReviewInitial, type WeeklyReviewInitial } from "@/lib/routines/checkinPrefill";
import { toWeekMorningRecap, type MorningRecapItem } from "@/lib/routines/morningRecap";
import { WeeklyReviewForm } from "@/components/routines/WeeklyReviewForm";

/** The ISO date `days` after a YYYY-MM-DD civil date (UTC-anchored, like the rest
 *  of the date math in lib/routines/dates.ts). */
function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

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

  const monday = getMondayOfWeek(now, profile.timezone);

  // Pre-fill this week's already-saved review so editing it across Fri/Sat/Sun
  // doesn't wipe what was saved earlier (finding E2). Also pull this week's
  // morning "my own routines today" notes for the read-only recap below.
  // Best-effort: any failure just renders a blank form with no recap.
  let initial: WeeklyReviewInitial = toWeeklyReviewInitial(null);
  let recap: MorningRecapItem[] = [];
  try {
    const privateClient = await createClient("private");
    const [{ data: reviewRow }, { data: mornings }] = await Promise.all([
      privateClient
        .from("weekly_reviews")
        .select(
          "habits_served_well, challenges_helped_grow, lessons_learned, challenges_overcome, feels_better_from_habits, one_thing_to_improve, habits_to_double_down"
        )
        .eq("user_id", profile.id)
        .eq("week_start_date", monday)
        .maybeSingle(),
      // This week's self-directed morning routines (Mon–Sun), recapped read-only.
      privateClient
        .from("morning_entries")
        .select("entry_date, extra_routines")
        .eq("user_id", profile.id)
        .gte("entry_date", monday)
        .lte("entry_date", addDaysISO(monday, 6))
        .order("entry_date", { ascending: true }),
    ]);
    initial = toWeeklyReviewInitial(reviewRow);
    recap = toWeekMorningRecap(mornings);
  } catch {
    initial = toWeeklyReviewInitial(null);
    recap = [];
  }

  return (
    // Dark "ink" surface, matching the Today board (full-width wrapper carries
    // the scope + ground paint; the <main> stays the centered column).
    <div data-surface="ink" className="min-h-full bg-background text-foreground">
    <main className="mx-auto max-w-xl px-6 py-12">
      <Link href="/home" className="mb-6 inline-block text-sm text-muted hover:text-foreground">
        ← Today
      </Link>

      {/* Recognise the member's own self-directed morning routines this week
          (recorded on the Morning Routine; Anthony's ask) — read-only, as context
          to reflect on before the review prompts. */}
      {recap.length > 0 ? (
        <section className="mb-8 border border-rule-hairline p-4">
          <h2 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
            Your own routines this week
          </h2>
          <p className="mt-1 text-xs text-muted">
            What you chose to do each morning, outside the NTITT framework.
          </p>
          <ul className="mt-3 space-y-2">
            {recap.map((r) => (
              <li key={r.date} className="text-sm">
                <span className="font-semibold">{r.weekday}</span>
                <span className="whitespace-pre-line"> — {r.note}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mb-8 text-xs text-muted">
          Tip: note your own routines each morning and they&rsquo;ll gather here to reflect on.
        </p>
      )}

      <WeeklyReviewForm initial={initial} />
    </main>
    </div>
  );
}
