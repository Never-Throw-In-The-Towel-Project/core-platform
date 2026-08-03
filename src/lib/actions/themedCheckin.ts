"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { catchUpEligibleWeekdays, getMondayOfWeek, weekdayNameOrWeekend } from "@/lib/routines/dates";
import { CHECKIN_CONFIG, type TextCheckinWeekday } from "@/lib/routines/checkinConfig";
import { type RoutineActionState } from "./routineState";

const TEXT_CHECKIN_WEEKDAYS: readonly TextCheckinWeekday[] = ["monday", "tuesday", "thursday", "friday"];

/**
 * Handles Momentum Monday, Talking Tuesday, Thoughts on Thursday, and Feel
 * Good Friday -- the four themed check-ins that are plain prompt-and-answer
 * forms. Workout Wednesday is structurally different (exercise bank + tier
 * picker, not free-text prompts) and has its own action, submitWorkoutWednesday.
 *
 * Accepts an optional "weekday" field for this-week catch-up (see
 * docs/ARCHITECTURE.md "Daily core loop") -- revised from the original
 * no-backfill design, which had no such field at all. The requested weekday
 * is validated against catchUpEligibleWeekdays, which the server computes
 * itself from the real clock and the user's own timezone: a client can ask
 * for any day that's genuinely opened in the current real week, but there
 * is still nothing to submit that reaches a future day or a different week.
 * Falls back to today's own weekday when the field is absent, so the
 * ordinary same-day submission (the vast majority of the time) is unchanged.
 */
export async function submitThemedCheckin(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();
  const profile = await getProfile();
  const now = new Date();
  const eligible = catchUpEligibleWeekdays(now, profile.timezone);
  const requested = formData.get("weekday");
  const weekday =
    typeof requested === "string" && requested.length > 0
      ? requested
      : weekdayNameOrWeekend(now, profile.timezone);

  if (!eligible.includes(weekday as (typeof eligible)[number]) || !TEXT_CHECKIN_WEEKDAYS.includes(weekday as TextCheckinWeekday)) {
    return { status: "error", message: "There's no check-in to complete right now." };
  }

  const checkinWeekday = weekday as TextCheckinWeekday;
  const config = CHECKIN_CONFIG[checkinWeekday];

  const fieldSchema: Record<string, z.ZodOptional<z.ZodString>> = {};
  for (const field of config.fields) {
    fieldSchema[field.key] = z.string().max(4000).optional();
  }

  const parsed = z.object(fieldSchema).safeParse(
    Object.fromEntries(config.fields.map((field) => [field.key, formData.get(field.key) || undefined]))
  );

  if (!parsed.success) {
    return { status: "error", message: "Please check the form and try again." };
  }

  const answers: Record<string, string> = {};
  for (const field of config.fields) {
    const value = parsed.data[field.key];
    if (value) answers[field.key] = value;
  }

  const supabase = await createClient("private");

  let goals: { goals: string[] } | null = null;
  if (checkinWeekday === "monday") {
    const goalValues = [formData.get("goal1"), formData.get("goal2"), formData.get("goal3")]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.length > 0);
    goals = { goals: goalValues };
  }

  if (checkinWeekday === "friday") {
    // Per Anthony's guidance: the goal-check is only asked if Monday's
    // goals actually exist for this week -- derived server-side from the
    // real Monday row, not trusted from the form, same reasoning as the
    // weekday lock itself. If Monday was skipped, Friday just skips this
    // question rather than showing it empty or blocking completion on it.
    const { data: mondayRow } = await supabase
      .from("themed_checkins")
      .select("goals")
      .eq("user_id", session.userId)
      .eq("week_start_date", getMondayOfWeek(now, profile.timezone))
      .eq("weekday", "monday")
      .maybeSingle();

    const mondayGoals = (mondayRow?.goals as { goals?: string[] } | null)?.goals ?? [];

    if (mondayGoals.length > 0) {
      const achievedStatus = formData.get("achieved_monday_goals");
      if (
        typeof achievedStatus !== "string" ||
        !["yes", "partially", "no"].includes(achievedStatus)
      ) {
        return { status: "error", message: "Please let us know how Monday's goals went." };
      }
      answers.achieved_monday_goals = achievedStatus;
    }
  }

  const { error } = await supabase.from("themed_checkins").upsert(
    {
      user_id: session.userId,
      week_start_date: getMondayOfWeek(now, profile.timezone),
      weekday: checkinWeekday,
      goals,
      answers,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,week_start_date,weekday" }
  );

  if (error) {
    return { status: "error", message: "Something went wrong saving this. Please try again." };
  }

  return { status: "success" };
}

const WorkoutTierSchema = z.enum(["beginner", "intermediate", "advanced", "elite"]);

export async function submitWorkoutWednesday(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();
  const profile = await getProfile();
  const now = new Date();

  // Same this-week catch-up rule as submitThemedCheckin: Wednesday is
  // reachable any day from Wednesday itself onward in the real current week.
  if (!catchUpEligibleWeekdays(now, profile.timezone).includes("wednesday")) {
    return { status: "error", message: "Workout Wednesday isn't available right now." };
  }

  const parsed = WorkoutTierSchema.safeParse(formData.get("tier"));
  if (!parsed.success) {
    return { status: "error", message: "Please select a difficulty level." };
  }

  const supabase = await createClient("private");

  const { error } = await supabase.from("themed_checkins").upsert(
    {
      user_id: session.userId,
      week_start_date: getMondayOfWeek(now, profile.timezone),
      weekday: "wednesday",
      answers: { tier: parsed.data },
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,week_start_date,weekday" }
  );

  if (error) {
    return { status: "error", message: "Something went wrong saving this. Please try again." };
  }

  return { status: "success" };
}
