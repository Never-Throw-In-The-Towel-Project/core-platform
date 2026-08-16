"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isAiConfigured } from "@/lib/ai/client";
import { proposeWeeklySchedule } from "@/lib/ai/weeklySchedule";
import { layOutSchedule } from "@/lib/content/scheduleLayout";
import { type RoutineActionState } from "./routineState";

/**
 * The calendar's "suggest a week" pass (docs/CONTENT_PLATFORM_STRATEGY.md — the
 * AI brain distributes content across the Mon–Sun framework). Two halves, both
 * ntitt_admin-gated and assistive-with-confirm:
 *   • proposeWeeklyScheduleAction — reads a batch of items and asks the model for
 *     a weekday (0 = Any day, 1–7 = Mon–Sun) per item. Writes NOTHING; returns a
 *     plan for the admin to review and edit.
 *   • applyWeeklyScheduleAction — writes the approved day_of_week values (the
 *     exact dimension the day-of-week carousel rotates through).
 */

// One AI call stays within max_tokens; the Week board runs it over the
// unassigned pool, which is normally modest.
const MAX_BATCH = 60;

type DayProposalView = { itemId: string; title: string; currentDay: number | null; day: number };

export type WeeklySchedulePlan = { proposals: DayProposalView[]; truncated: number };

export type ProposeScheduleResult =
  | { status: "ok"; plan: WeeklySchedulePlan }
  | { status: "error"; message: string };

export async function proposeWeeklyScheduleAction(input: {
  itemIds: string[];
}): Promise<ProposeScheduleResult> {
  await requireNtittAdmin();

  if (!isAiConfigured()) {
    return { status: "error", message: "AI scheduling isn’t configured in this environment yet." };
  }

  const parsed = z.array(z.string().uuid()).min(1).max(1000).safeParse(input.itemIds);
  if (!parsed.success) {
    return { status: "error", message: "There’s nothing here to schedule." };
  }

  const batch = parsed.data.slice(0, MAX_BATCH);
  const truncated = parsed.data.length - batch.length;

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("content_items")
      .select("id, title, summary, type, category, tags, day_of_week")
      .in("id", batch);

    const items =
      (data as
        | {
            id: string;
            title: string;
            summary: string | null;
            type: string;
            category: string;
            tags: string[];
            day_of_week: number | null;
          }[]
        | null) ?? [];
    if (items.length === 0) {
      return { status: "error", message: "Couldn’t load those items to schedule. Please try again." };
    }

    const proposals = await proposeWeeklySchedule(
      items.map((i) => ({
        id: i.id,
        title: i.title,
        summary: i.summary,
        type: i.type,
        category: i.category,
        tags: i.tags,
      }))
    );

    const byId = new Map(items.map((i) => [i.id, i]));
    const view: DayProposalView[] = proposals
      .filter((p) => byId.has(p.id))
      .map((p) => ({ itemId: p.id, title: byId.get(p.id)!.title, currentDay: byId.get(p.id)!.day_of_week, day: p.day }));

    if (view.length === 0) {
      return { status: "error", message: "The AI didn’t return any usable suggestions. Please try again." };
    }

    return { status: "ok", plan: { proposals: view, truncated } };
  } catch {
    return { status: "error", message: "Couldn’t reach the AI just now — try again in a moment." };
  }
}

const AssignmentSchema = z.object({
  itemId: z.string().uuid(),
  day: z.number().int().min(0).max(7),
});

export async function applyWeeklyScheduleAction(input: {
  assignments: { itemId: string; day: number }[];
}): Promise<RoutineActionState> {
  await requireNtittAdmin();

  const parsed = z.array(AssignmentSchema).min(1).max(MAX_BATCH).safeParse(input.assignments);
  if (!parsed.success) {
    return { status: "error", message: "Nothing selected to apply." };
  }

  try {
    const supabase = await createClient();
    for (const a of parsed.data) {
      const { error } = await supabase
        .from("content_items")
        .update({ day_of_week: a.day === 0 ? null : a.day })
        .eq("id", a.itemId);
      if (error) {
        return { status: "error", message: "Applied some of the schedule, but not all — please review and retry." };
      }
    }
  } catch {
    return { status: "error", message: "Couldn’t apply the schedule just now. Please try again." };
  }

  revalidatePath("/admin/calendar");
  revalidatePath("/admin/content");
  revalidatePath("/admin/brain");
  revalidatePath("/content");
  revalidatePath("/home");
  return { status: "success" };
}

// ---- Month (dated) schedule --------------------------------------------------

type DatedProposalView = { itemId: string; title: string; date: string };

export type MonthSchedulePlan = { proposals: DatedProposalView[]; truncated: number };

export type ProposeMonthScheduleResult =
  | { status: "ok"; plan: MonthSchedulePlan }
  | { status: "error"; message: string };

/**
 * Suggest a dated publish schedule for a batch of drafts. The AI does only the
 * SEMANTIC part — which weekday theme each piece fits (reusing
 * proposeWeeklySchedule) — and layOutSchedule turns those weekdays into concrete
 * dates (next occurrence of the weekday, same-weekday items rolled onto
 * successive weeks). So the model never reasons about dates and can't propose a
 * past/invalid one. Base date is tomorrow (UTC), giving lead time before the
 * daily publish cron.
 */
export async function proposeMonthScheduleAction(input: {
  itemIds: string[];
}): Promise<ProposeMonthScheduleResult> {
  await requireNtittAdmin();

  if (!isAiConfigured()) {
    return { status: "error", message: "AI scheduling isn’t configured in this environment yet." };
  }

  const parsed = z.array(z.string().uuid()).min(1).max(1000).safeParse(input.itemIds);
  if (!parsed.success) {
    return { status: "error", message: "There’s nothing here to schedule." };
  }

  const batch = parsed.data.slice(0, MAX_BATCH);
  const truncated = parsed.data.length - batch.length;

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("content_items")
      .select("id, title, summary, type, category, tags")
      .in("id", batch);

    const items =
      (data as
        | { id: string; title: string; summary: string | null; type: string; category: string; tags: string[] }[]
        | null) ?? [];
    if (items.length === 0) {
      return { status: "error", message: "Couldn’t load those items to schedule. Please try again." };
    }

    const proposals = await proposeWeeklySchedule(
      items.map((i) => ({
        id: i.id,
        title: i.title,
        summary: i.summary,
        type: i.type,
        category: i.category,
        tags: i.tags,
      }))
    );

    // Base = tomorrow (UTC). layOutSchedule maps weekday → concrete date.
    const t = new Date();
    t.setUTCDate(t.getUTCDate() + 1);
    const base = t.toISOString().slice(0, 10);
    const dated = layOutSchedule(proposals, base);

    const byId = new Map(items.map((i) => [i.id, i]));
    const view: DatedProposalView[] = dated
      .filter((d) => byId.has(d.id))
      .map((d) => ({ itemId: d.id, title: byId.get(d.id)!.title, date: d.date }))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (view.length === 0) {
      return { status: "error", message: "The AI didn’t return any usable suggestions. Please try again." };
    }

    return { status: "ok", plan: { proposals: view, truncated } };
  } catch {
    return { status: "error", message: "Couldn’t reach the AI just now — try again in a moment." };
  }
}

const DateAssignmentSchema = z.object({
  itemId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function applyMonthScheduleAction(input: {
  assignments: { itemId: string; date: string }[];
}): Promise<RoutineActionState> {
  await requireNtittAdmin();

  const parsed = z.array(DateAssignmentSchema).min(1).max(MAX_BATCH).safeParse(input.assignments);
  if (!parsed.success) {
    return { status: "error", message: "Nothing selected to apply." };
  }

  try {
    const supabase = await createClient();
    for (const a of parsed.data) {
      const { error } = await supabase.from("content_items").update({ scheduled_for: a.date }).eq("id", a.itemId);
      if (error) {
        return { status: "error", message: "Applied some of the schedule, but not all — please review and retry." };
      }
    }
  } catch {
    return { status: "error", message: "Couldn’t apply the schedule just now. Please try again." };
  }

  revalidatePath("/admin/calendar");
  revalidatePath("/admin/content");
  revalidatePath("/admin/brain");
  return { status: "success" };
}
