"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { type RoutineActionState } from "./routineState";

/**
 * Content distribution calendar actions (docs/CONTENT_PLATFORM_STRATEGY.md —
 * the Mon–Sun framework as the organising grid). This first slice is the WEEK
 * planner: assign a content item to a weekday (or back to "Any day"), which
 * simply writes content_items.day_of_week — the exact dimension the day-of-week
 * carousel already rotates through, so an item dropped on Wednesday starts
 * surfacing to members on Wednesdays with no other wiring. ntitt_admin only: the
 * role is checked here for a friendly message, but the content_items UPDATE RLS
 * policy is the real gate (same defense-in-depth as lib/actions/content.ts).
 */

const DaySchema = z.object({
  itemId: z.string().uuid(),
  // "" = Any day (day-agnostic, null). "1".."7" = ISO weekday (Mon..Sun).
  day: z.union([z.literal(""), z.enum(["1", "2", "3", "4", "5", "6", "7"])]),
});

export async function setContentItemDay(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await verifySession();
  const profile = await getProfile();
  if (profile.role !== "ntitt_admin") {
    return { status: "error", message: "You don’t have access to the calendar." };
  }

  const parsed = DaySchema.safeParse({
    itemId: formData.get("itemId"),
    day: formData.get("day") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: "Couldn’t update that item." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("content_items")
      .update({ day_of_week: parsed.data.day === "" ? null : Number(parsed.data.day) })
      .eq("id", parsed.data.itemId);
    if (error) {
      return { status: "error", message: "Couldn’t move that item. Please try again." };
    }
  } catch {
    return { status: "error", message: "Couldn’t move that item. Please try again." };
  }

  // The carousel (/home) and the Library both read day_of_week, so refresh them
  // alongside the calendar and Studio surfaces.
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/content");
  revalidatePath("/admin/brain");
  revalidatePath("/content");
  revalidatePath("/home");
  return { status: "success" };
}
