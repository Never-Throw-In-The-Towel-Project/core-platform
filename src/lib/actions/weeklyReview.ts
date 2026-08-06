"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { getMondayOfWeek, weekdayNameOrWeekend } from "@/lib/routines/dates";
import { type RoutineActionState } from "./routineState";

const WeeklyReviewSchema = z.object({
  habitsServedWell: z.string().max(2000).optional(),
  challengesHelpedGrow: z.string().max(2000).optional(),
  lessonsLearned: z.string().max(2000).optional(),
  challengesOvercome: z.string().max(2000).optional(),
  feelsBetterFromHabits: z.string().max(2000).optional(),
  oneThingToImprove: z.string().max(2000).optional(),
  habitsToDoubleDown: z.string().max(2000).optional(),
});

export async function submitWeeklyReview(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();
  const profile = await getProfile();
  const now = new Date();

  // Per the brief, Weekly Review is its own section, separate from Feel
  // Good Friday, "accessible from Friday onwards through the weekend" --
  // enforced server-side, same no-guessing pattern as the themed check-ins.
  const weekday = weekdayNameOrWeekend(now, profile.timezone);
  if (weekday !== "friday" && weekday !== "saturday" && weekday !== "sunday") {
    return { status: "error", message: "Weekly Review opens from Friday onwards." };
  }

  const parsed = WeeklyReviewSchema.safeParse({
    habitsServedWell: formData.get("habitsServedWell") || undefined,
    challengesHelpedGrow: formData.get("challengesHelpedGrow") || undefined,
    lessonsLearned: formData.get("lessonsLearned") || undefined,
    challengesOvercome: formData.get("challengesOvercome") || undefined,
    feelsBetterFromHabits: formData.get("feelsBetterFromHabits") || undefined,
    oneThingToImprove: formData.get("oneThingToImprove") || undefined,
    habitsToDoubleDown: formData.get("habitsToDoubleDown") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: "Please check the form and try again." };
  }

  const data = parsed.data;

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  try {
    const supabase = await createClient("private");

    const { error } = await supabase.from("weekly_reviews").upsert(
      {
        user_id: session.userId,
        week_start_date: getMondayOfWeek(now, profile.timezone),
        habits_served_well: data.habitsServedWell ?? null,
        challenges_helped_grow: data.challengesHelpedGrow ?? null,
        lessons_learned: data.lessonsLearned ?? null,
        challenges_overcome: data.challengesOvercome ?? null,
        feels_better_from_habits: data.feelsBetterFromHabits ?? null,
        one_thing_to_improve: data.oneThingToImprove ?? null,
        habits_to_double_down: data.habitsToDoubleDown ?? null,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,week_start_date" }
    );

    if (error) {
      return { status: "error", message: "Something went wrong saving this. Please try again." };
    }
  } catch {
    return { status: "error", message: "Something went wrong saving this. Please try again." };
  }

  return { status: "success" };
}
