"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { todayISODate } from "@/lib/routines/dates";
import { type RoutineActionState } from "./routineState";

// Every write here goes through createClient("private") as the caller's own
// session, and stamps user_id from the session -- never the client. RLS enforces
// the same own-rows boundary, so a member can only ever touch their own recovery
// data. Sensitive by nature (smoking, gambling, ...): nothing is logged with the
// habit label, and no path exposes it beyond the owner.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function revalidateHabitSurfaces() {
  revalidatePath("/clean-streak");
  revalidatePath("/home"); // Today rail card
  revalidatePath("/journey"); // Journey card
}

const CreateSchema = z.object({
  habitLabel: z.string().trim().min(1).max(80),
  targetDays: z.coerce.number().int().min(1).max(366),
});

/** Start a new Clean Streak challenge. started_on is the caller's local today. */
export async function createHabitChallengeAction(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();
  const profile = await getProfile();

  const parsed = CreateSchema.safeParse({
    habitLabel: formData.get("habitLabel"),
    targetDays: formData.get("targetDays"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Add what you’re quitting and a length between 1 and 366 days." };
  }

  try {
    const supabase = await createClient("private");
    const { error } = await supabase.from("habit_challenges").insert({
      user_id: session.userId,
      habit_label: parsed.data.habitLabel,
      target_days: parsed.data.targetDays,
      started_on: todayISODate(new Date(), profile.timezone),
      status: "active",
    });
    if (error) return { status: "error", message: "Couldn’t start that. Please try again." };
  } catch {
    return { status: "error", message: "Couldn’t start that. Please try again." };
  }

  revalidateHabitSurfaces();
  return { status: "success" };
}

const ExtendSchema = z.object({
  id: z.string().uuid(),
  targetDays: z.coerce.number().int().min(1).max(366),
});

/** Extend (or reduce, but usually extend) a challenge's goal. Extending a
 *  completed one revives it to active so the member can keep going. */
export async function extendHabitChallengeAction(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await verifySession();
  const parsed = ExtendSchema.safeParse({ id: formData.get("id"), targetDays: formData.get("targetDays") });
  if (!parsed.success) return { status: "error", message: "Pick a new length between 1 and 366 days." };

  try {
    const supabase = await createClient("private");
    const { data: current } = await supabase
      .from("habit_challenges")
      .select("status")
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (!current) return { status: "error", message: "Couldn’t find that challenge." };

    const { error } = await supabase
      .from("habit_challenges")
      .update({
        target_days: parsed.data.targetDays,
        // Extending a finished challenge means you're carrying on -> active again.
        status: (current as { status: string }).status === "completed" ? "active" : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.id);
    if (error) return { status: "error", message: "Couldn’t update that. Please try again." };
  } catch {
    return { status: "error", message: "Couldn’t update that. Please try again." };
  }

  revalidateHabitSurfaces();
  return { status: "success" };
}

const MarkSchema = z.object({
  challengeId: z.string().uuid(),
  date: z.string().regex(DATE_RE),
  outcome: z.enum(["success", "slip", "clear"]),
});

/** Mark a day clean / slip, or clear the mark. The date must be within the
 *  challenge window and never in the future (both checked server-side against
 *  the caller's timezone). Upsert on (user, challenge, day) so re-marking a day
 *  corrects it rather than duplicating. */
export async function markHabitDayAction(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();
  const profile = await getProfile();

  const parsed = MarkSchema.safeParse({
    challengeId: formData.get("challengeId"),
    date: formData.get("date"),
    outcome: formData.get("outcome"),
  });
  if (!parsed.success) return { status: "error", message: "Couldn’t record that day." };
  const { challengeId, date, outcome } = parsed.data;

  try {
    const supabase = await createClient("private");
    const { data: challenge } = await supabase
      .from("habit_challenges")
      .select("started_on, target_days")
      .eq("id", challengeId)
      .maybeSingle();
    if (!challenge) return { status: "error", message: "Couldn’t find that challenge." };

    const today = todayISODate(new Date(), profile.timezone);
    const startedOn = (challenge as { started_on: string; target_days: number }).started_on;
    const targetDays = (challenge as { started_on: string; target_days: number }).target_days;
    // yyyy-mm-dd strings compare chronologically.
    if (date > today) return { status: "error", message: "You can’t mark a day in the future." };
    if (date < startedOn) return { status: "error", message: "That’s before this challenge started." };

    if (outcome === "clear") {
      const { error } = await supabase
        .from("habit_check_ins")
        .delete()
        .eq("habit_challenge_id", challengeId)
        .eq("check_in_date", date);
      if (error) return { status: "error", message: "Couldn’t update that day. Please try again." };
    } else {
      const { error } = await supabase.from("habit_check_ins").upsert(
        {
          user_id: session.userId,
          habit_challenge_id: challengeId,
          check_in_date: date,
          outcome,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,habit_challenge_id,check_in_date" }
      );
      if (error) return { status: "error", message: "Couldn’t update that day. Please try again." };

      // Completion: the first time a member's clean days reach their own goal,
      // award the private Clean Streak badge (own-rows, idempotent via the
      // unique (user, badge_key)). Only ever fires when marking a day clean.
      if (outcome === "success") {
        await awardHabitCompleteIfReached(supabase, session.userId, challengeId, targetDays);
      }
    }
  } catch {
    return { status: "error", message: "Couldn’t update that day. Please try again." };
  }

  revalidateHabitSurfaces();
  return { status: "success" };
}

type PrivateClient = Awaited<ReturnType<typeof createClient>>;

/** Award the private "Clean Streak" badge once the member's clean-day count for
 *  a challenge reaches its goal. Idempotent (unique user+badge_key, insert-only)
 *  and best-effort: a badge hiccup must never fail the day's check-in. The count
 *  runs under the caller's own private client, so RLS scopes it to their rows. */
async function awardHabitCompleteIfReached(
  supabase: PrivateClient,
  userId: string,
  challengeId: string,
  targetDays: number
): Promise<void> {
  try {
    const { count } = await supabase
      .from("habit_check_ins")
      .select("*", { count: "exact", head: true })
      .eq("habit_challenge_id", challengeId)
      .eq("outcome", "success");
    if ((count ?? 0) >= targetDays) {
      await supabase.from("earned_badges").upsert(
        { user_id: userId, badge_key: "habit_complete", earned_at: new Date().toISOString() },
        { onConflict: "user_id,badge_key", ignoreDuplicates: true }
      );
    }
  } catch {
    // best-effort
  }
}

const StatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["active", "completed", "abandoned"]),
});

/** Set a challenge's status (mark complete, give it up, or reactivate). */
export async function setHabitStatusAction(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await verifySession();
  const parsed = StatusSchema.safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!parsed.success) return { status: "error", message: "Couldn’t update that challenge." };

  try {
    const supabase = await createClient("private");
    const { error } = await supabase
      .from("habit_challenges")
      .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.id);
    if (error) return { status: "error", message: "Couldn’t update that. Please try again." };
  } catch {
    return { status: "error", message: "Couldn’t update that. Please try again." };
  }

  revalidateHabitSurfaces();
  return { status: "success" };
}
