"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { todayISODate } from "@/lib/routines/dates";
import { type RoutineActionState } from "./routineState";

// Every write goes through createClient("private") as the caller's own session
// and stamps user_id from the session -- never the client. RLS enforces the same
// own-rows boundary, so a member can only ever touch their own routines. Nothing
// here is reported or shared (see 20261110010000_user_routines.sql).

function revalidateRoutineSurfaces() {
  revalidatePath("/routines");
  revalidatePath("/home"); // Today rail card
}

const WeekdaySchema = z.coerce.number().int().min(1).max(7);
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const RoutineFieldsSchema = z.object({
  label: z.string().trim().min(1).max(80),
  weekdays: z.array(WeekdaySchema).min(1).max(7),
  timeOfDay: z.string().regex(TIME_RE).optional(),
});

/** Sorted, de-duplicated ISO weekdays (1..7) -- the shape stored in the array column. */
function normaliseWeekdays(days: number[]): number[] {
  return Array.from(new Set(days)).sort((a, b) => a - b);
}

/** Create a routine. `weekdays` arrives as repeated form fields. */
export async function createRoutineAction(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();

  const parsed = RoutineFieldsSchema.safeParse({
    label: formData.get("label"),
    weekdays: formData.getAll("weekdays"),
    timeOfDay: formData.get("timeOfDay") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: "Add a name and pick at least one day." };
  }

  try {
    const supabase = await createClient("private");
    const { error } = await supabase.from("user_routines").insert({
      user_id: session.userId,
      label: parsed.data.label,
      weekdays: normaliseWeekdays(parsed.data.weekdays),
      time_of_day: parsed.data.timeOfDay ?? null,
      active: true,
    });
    if (error) return { status: "error", message: "Couldn’t add that. Please try again." };
  } catch {
    return { status: "error", message: "Couldn’t add that. Please try again." };
  }

  revalidateRoutineSurfaces();
  return { status: "success" };
}

const UpdateSchema = RoutineFieldsSchema.extend({ id: z.string().uuid() });

/** Edit a routine's name, days or time. Only the member's own row (RLS). */
export async function updateRoutineAction(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await verifySession();

  const parsed = UpdateSchema.safeParse({
    id: formData.get("id"),
    label: formData.get("label"),
    weekdays: formData.getAll("weekdays"),
    timeOfDay: formData.get("timeOfDay") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: "Add a name and pick at least one day." };
  }

  try {
    const supabase = await createClient("private");
    const { error } = await supabase
      .from("user_routines")
      .update({
        label: parsed.data.label,
        weekdays: normaliseWeekdays(parsed.data.weekdays),
        time_of_day: parsed.data.timeOfDay ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.id);
    if (error) return { status: "error", message: "Couldn’t save that. Please try again." };
  } catch {
    return { status: "error", message: "Couldn’t save that. Please try again." };
  }

  revalidateRoutineSurfaces();
  return { status: "success" };
}

const SetActiveSchema = z.object({ id: z.string().uuid(), active: z.enum(["true", "false"]) });

/** Retire (active=false) or restore a routine, keeping its completion history. */
export async function setRoutineActiveAction(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await verifySession();
  const parsed = SetActiveSchema.safeParse({ id: formData.get("id"), active: formData.get("active") });
  if (!parsed.success) return { status: "error", message: "Couldn’t update that routine." };

  try {
    const supabase = await createClient("private");
    const { error } = await supabase
      .from("user_routines")
      .update({ active: parsed.data.active === "true", updated_at: new Date().toISOString() })
      .eq("id", parsed.data.id);
    if (error) return { status: "error", message: "Couldn’t update that. Please try again." };
  } catch {
    return { status: "error", message: "Couldn’t update that. Please try again." };
  }

  revalidateRoutineSurfaces();
  return { status: "success" };
}

const DeleteSchema = z.object({ id: z.string().uuid() });

/** Permanently delete a routine and its completions (FK cascade). */
export async function deleteRoutineAction(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await verifySession();
  const parsed = DeleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { status: "error", message: "Couldn’t delete that routine." };

  try {
    const supabase = await createClient("private");
    const { error } = await supabase.from("user_routines").delete().eq("id", parsed.data.id);
    if (error) return { status: "error", message: "Couldn’t delete that. Please try again." };
  } catch {
    return { status: "error", message: "Couldn’t delete that. Please try again." };
  }

  revalidateRoutineSurfaces();
  return { status: "success" };
}

/**
 * Tick / untick a routine for today, from the Today board (optimistic, like the
 * STAND widget). The day is derived SERVER-SIDE from the member's timezone; the
 * client only sends which routine and whether it's done. Ownership is verified
 * under the caller's own RLS-scoped client first (matching markHabitDayAction),
 * so a completion can never attach to someone else's routine.
 */
export async function setRoutineDone(routineId: string, done: boolean): Promise<{ ok: boolean }> {
  if (typeof routineId !== "string" || typeof done !== "boolean") return { ok: false };

  const session = await verifySession();
  const profile = await getProfile();
  const date = todayISODate(new Date(), profile.timezone);

  try {
    const supabase = await createClient("private");

    // Confirm the routine is the caller's own (RLS scopes this read to their
    // rows); a missing row means it isn't theirs / doesn't exist.
    const { data: routine } = await supabase
      .from("user_routines")
      .select("id")
      .eq("id", routineId)
      .maybeSingle();
    if (!routine) return { ok: false };

    if (done) {
      const { error } = await supabase.from("user_routine_completions").upsert(
        { user_id: session.userId, routine_id: routineId, completion_date: date },
        { onConflict: "user_id,routine_id,completion_date", ignoreDuplicates: true }
      );
      return { ok: !error };
    }

    const { error } = await supabase
      .from("user_routine_completions")
      .delete()
      .eq("routine_id", routineId)
      .eq("completion_date", date);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
