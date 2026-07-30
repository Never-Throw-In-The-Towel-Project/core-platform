"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { verifySession } from "@/lib/auth/dal";
import { getMondayOfWeek, weekdayNameOrWeekend } from "@/lib/routines/dates";
import { CHECKIN_CONFIG, type TextCheckinWeekday } from "@/lib/routines/checkinConfig";
import { type RoutineActionState } from "./routineState";

const TEXT_CHECKIN_WEEKDAYS: readonly TextCheckinWeekday[] = ["monday", "tuesday", "thursday", "friday"];

/**
 * Handles Momentum Monday, Talking Tuesday, Thoughts on Thursday, and Feel
 * Good Friday -- the four themed check-ins that are plain prompt-and-answer
 * forms. Workout Wednesday is structurally different (exercise bank + tier
 * picker, not free-text prompts) and has its own action, submitWorkoutWednesday.
 *
 * The server derives "today" itself rather than trusting a client-submitted
 * weekday -- this is what enforces the week-journey accountability rule (see
 * docs/ARCHITECTURE.md): there is no form field for "which day is this", so
 * there is nothing for a client to lie about to backfill a missed day.
 */
export async function submitThemedCheckin(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();
  const now = new Date();
  const weekday = weekdayNameOrWeekend(now);

  if (!TEXT_CHECKIN_WEEKDAYS.includes(weekday as TextCheckinWeekday)) {
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

  let goals: { goals: string[] } | null = null;
  if (checkinWeekday === "monday") {
    const goalValues = [formData.get("goal1"), formData.get("goal2"), formData.get("goal3")]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.length > 0);
    goals = { goals: goalValues };
  }

  if (checkinWeekday === "friday") {
    const achievedStatus = formData.get("achieved_monday_goals");
    if (
      typeof achievedStatus !== "string" ||
      !["yes", "partially", "no"].includes(achievedStatus)
    ) {
      return { status: "error", message: "Please let us know how Monday's goals went." };
    }
    answers.achieved_monday_goals = achievedStatus;
  }

  const supabase = await createClient();

  const { error } = await supabase.from("themed_checkins").upsert(
    {
      user_id: session.userId,
      week_start_date: getMondayOfWeek(now),
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
  const now = new Date();

  if (weekdayNameOrWeekend(now) !== "wednesday") {
    return { status: "error", message: "Workout Wednesday isn't today." };
  }

  const parsed = WorkoutTierSchema.safeParse(formData.get("tier"));
  if (!parsed.success) {
    return { status: "error", message: "Please select a difficulty level." };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("themed_checkins").upsert(
    {
      user_id: session.userId,
      week_start_date: getMondayOfWeek(now),
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
