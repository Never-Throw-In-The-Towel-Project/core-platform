import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getNextMonday, weekdayNameOrWeekend } from "@/lib/routines/dates";
import { toSundaySetupInitial, type SundaySetupInitial } from "@/lib/routines/checkinPrefill";
import { SundaySetupForm } from "@/components/routines/SundaySetupForm";

export default async function SundaySetupPage() {
  const profile = await getProfile();
  if (weekdayNameOrWeekend(new Date(), profile.timezone) !== "sunday") {
    redirect("/home");
  }

  // Pre-fill this Sunday's already-saved setup (keyed on next Monday, like the
  // action) so a second, partial submit can't wipe the first (finding E2).
  // Best-effort: any failure just renders a blank form.
  let initial: SundaySetupInitial = toSundaySetupInitial(null);
  try {
    const privateClient = await createClient("private");
    const { data } = await privateClient
      .from("sunday_setups")
      .select("prep_notes, intention")
      .eq("user_id", profile.id)
      .eq("week_start_date", getNextMonday(new Date(), profile.timezone))
      .maybeSingle();
    initial = toSundaySetupInitial(data);
  } catch {
    initial = toSundaySetupInitial(null);
  }

  return (
    // Dark "ink" surface, matching the Today board (full-width wrapper carries
    // the scope + ground paint; the <main> stays the centered column).
    <div data-surface="ink" className="min-h-full bg-background text-foreground">
    <main className="mx-auto max-w-xl px-6 py-12">
      <Link href="/home" className="mb-6 inline-block text-sm text-muted hover:text-foreground">
        ← Today
      </Link>
      <SundaySetupForm initial={initial} />
    </main>
    </div>
  );
}
