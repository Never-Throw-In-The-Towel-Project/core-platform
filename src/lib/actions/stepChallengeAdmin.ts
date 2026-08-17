"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHrAdmin } from "@/lib/auth/dal";
import { DIRECT_COMPANY_ID } from "@/lib/tenant/constants";
import { type RoutineActionState } from "./routineState";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter valid start and end dates.");

const CreateChallengeSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    targetSteps: z.coerce.number().int().min(1).max(100_000_000_000),
    rewardType: z.enum([
      "team_experience",
      "extra_day_off",
      "charity_donation",
      "prize_draw",
    ]),
    rewardName: z.string().trim().min(1).max(200),
    startsOn: isoDate,
    endsOn: isoDate,
  })
  .refine((d) => d.endsOn >= d.startsOn, {
    message: "The end date must be on or after the start date.",
    path: ["endsOn"],
  });

/**
 * HR creates (launches) a company step challenge for their OWN company. The
 * user is re-derived server-side via requireHrAdmin (never trusted from the
 * client), and the RLS insert policy independently re-checks hr_admin + company
 * ownership. Invited clients only: the shared self-signup pool is rejected here
 * with a friendly message (and barred by a CHECK at the DB as a backstop).
 * Launches as 'active'; the partial unique index enforces one active challenge
 * per company, surfaced here as a clear message rather than a raw error.
 */
export async function createChallengeAction(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const profile = await requireHrAdmin();

  if (profile.company_id === DIRECT_COMPANY_ID) {
    return { status: "error", message: "Step challenges aren't available for self-signup accounts." };
  }

  const parsed = CreateChallengeSchema.safeParse({
    title: formData.get("title"),
    targetSteps: formData.get("targetSteps"),
    rewardType: formData.get("rewardType"),
    rewardName: formData.get("rewardName"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  // A challenge can't be created already-ended (which would "complete" instantly
  // off historical steps). UTC "today" is a fine approximation here.
  if (parsed.data.endsOn < new Date().toISOString().slice(0, 10)) {
    return { status: "error", message: "The end date can't be in the past." };
  }

  try {
    const supabase = await createClient();

    // At most one active challenge per company at a time, surfaced here as a
    // clear message rather than a raw unique-violation from the partial index.
    // RLS scopes the read to the caller's own company.
    const { data: existing } = await supabase
      .from("company_step_challenges")
      .select("id")
      .eq("company_id", profile.company_id)
      .eq("status", "active")
      .limit(1);
    if (existing && existing.length > 0) {
      return {
        status: "error",
        message: "You already have an active challenge. It must finish before you start another.",
      };
    }

    const { error } = await supabase
      .from("company_step_challenges")
      .insert({
        company_id: profile.company_id,
        title: parsed.data.title,
        target_steps: parsed.data.targetSteps,
        reward_type: parsed.data.rewardType,
        reward_name: parsed.data.rewardName,
        starts_on: parsed.data.startsOn,
        ends_on: parsed.data.endsOn,
        status: "active",
        created_by: profile.id,
      });
    if (error) {
      if (error.code === "23505") {
        return {
          status: "error",
          message: "You already have an active challenge. It must finish before you start another.",
        };
      }
      return { status: "error", message: "Something went wrong creating the challenge. Please try again." };
    }
  } catch {
    return { status: "error", message: "Something went wrong creating the challenge. Please try again." };
  }

  // The setup form + resulting tile live on /workspace/challenges -- revalidate
  // that page so the launched challenge shows without a manual reload (the
  // /workspace overview shows participation KPIs, not the challenge).
  revalidatePath("/workspace/challenges");
  revalidatePath("/workspace");
  return { status: "success" };
}
