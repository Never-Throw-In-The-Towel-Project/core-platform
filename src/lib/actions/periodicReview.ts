"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { todayISODate } from "@/lib/routines/dates";
import { getActiveDayCount } from "@/lib/routines/dayState";
import {
  getFirstActiveDate,
  getHabitSummary,
  getPendingPeriodicReview,
} from "@/lib/routines/periodicReview";
import type { PeriodicReviewExtra, ReviewType, SelfAssessment } from "@/types/database";
import { type RoutineActionState } from "./routineState";

const SelfAssessmentSchema = z.object({
  mindset: z.coerce.number().int().min(1).max(10),
  energy: z.coerce.number().int().min(1).max(10),
  discipline: z.coerce.number().int().min(1).max(10),
  relationships: z.coerce.number().int().min(1).max(10),
  confidence: z.coerce.number().int().min(1).max(10),
  overall: z.coerce.number().int().min(1).max(10),
});

const PeriodicReviewSchema = z.object({
  reviewType: z.enum(["30_day", "90_day"]),
  mostProudOf: z.string().max(2000).optional(),
  mostConsistentHabits: z.string().max(2000).optional(),
  challengesFaced: z.string().max(2000).optional(),
  whatsWorking: z.string().max(2000).optional(),
  needsToChange: z.string().max(2000).optional(),
  focusNextPeriod: z.string().max(2000).optional(),
  commitmentSignedName: z.string().max(200).optional(),
  // 90-day only
  lifeChanges: z.string().max(2000).optional(),
  nextPeriodVision: z.string().max(2000).optional(),
});

/**
 * Handles both the 30-Day and 90-Day Review. The `reviewType` the client
 * submits is not trusted on its own -- it's checked against what's actually
 * due (getPendingPeriodicReview, keyed off the same active-engagement day
 * counter Phase 2 established) so a review can't be submitted early or
 * resubmitted once completed.
 */
export async function submitPeriodicReview(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();
  const profile = await getProfile();

  const parsed = PeriodicReviewSchema.safeParse({
    reviewType: formData.get("reviewType"),
    mostProudOf: formData.get("mostProudOf") || undefined,
    mostConsistentHabits: formData.get("mostConsistentHabits") || undefined,
    challengesFaced: formData.get("challengesFaced") || undefined,
    whatsWorking: formData.get("whatsWorking") || undefined,
    needsToChange: formData.get("needsToChange") || undefined,
    focusNextPeriod: formData.get("focusNextPeriod") || undefined,
    commitmentSignedName: formData.get("commitmentSignedName") || undefined,
    lifeChanges: formData.get("lifeChanges") || undefined,
    nextPeriodVision: formData.get("nextPeriodVision") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: "Please check the form and try again." };
  }

  const selfAssessmentParsed = SelfAssessmentSchema.safeParse({
    mindset: formData.get("mindset"),
    energy: formData.get("energy"),
    discipline: formData.get("discipline"),
    relationships: formData.get("relationships"),
    confidence: formData.get("confidence"),
    overall: formData.get("overall"),
  });

  if (!selfAssessmentParsed.success) {
    return { status: "error", message: "Please rate yourself 1-10 on every dimension." };
  }

  const { reviewType } = parsed.data;
  const winCount = reviewType === "90_day" ? 10 : 5;
  const topWins = Array.from({ length: winCount }, (_, i) => formData.get(`win_${i + 1}`))
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);

  const activeDayCount = await getActiveDayCount(session.userId);
  const pending = await getPendingPeriodicReview(session.userId, activeDayCount);

  if (pending !== reviewType) {
    return {
      status: "error",
      message: "This review isn't due yet, or has already been completed.",
    };
  }

  const periodStart = (await getFirstActiveDate(session.userId)) ?? todayISODate(new Date(), profile.timezone);
  const periodEnd = todayISODate(new Date(), profile.timezone);

  let extra: PeriodicReviewExtra = {};
  if (reviewType === "90_day") {
    const habitSummary = await getHabitSummary(session.userId, periodStart, periodEnd);

    const supabase = await createClient("private");
    const { data: thirtyDayReview } = await supabase
      .from("periodic_reviews")
      .select("self_assessment")
      .eq("user_id", session.userId)
      .eq("review_type", "30_day")
      .not("completed_at", "is", null)
      .maybeSingle();

    extra = {
      life_changes: parsed.data.lifeChanges,
      next_period_vision: parsed.data.nextPeriodVision,
      habit_summary: habitSummary,
      comparison_self_assessment: (thirtyDayReview?.self_assessment as SelfAssessment | null) ?? undefined,
    };
  }

  const supabase = await createClient("private");
  const { error } = await supabase.from("periodic_reviews").upsert(
    {
      user_id: session.userId,
      review_type: reviewType satisfies ReviewType,
      period_start: periodStart,
      period_end: periodEnd,
      most_proud_of: parsed.data.mostProudOf ?? null,
      most_consistent_habits: parsed.data.mostConsistentHabits ?? null,
      challenges_faced: parsed.data.challengesFaced ?? null,
      whats_working: parsed.data.whatsWorking ?? null,
      needs_to_change: parsed.data.needsToChange ?? null,
      top_wins: topWins,
      self_assessment: selfAssessmentParsed.data,
      focus_next_period: parsed.data.focusNextPeriod ?? null,
      commitment_signed_name: parsed.data.commitmentSignedName ?? null,
      commitment_signed_date: todayISODate(new Date(), profile.timezone),
      extra,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,review_type,period_start" }
  );

  if (error) {
    return { status: "error", message: "Something went wrong saving this. Please try again." };
  }

  return { status: "success" };
}
