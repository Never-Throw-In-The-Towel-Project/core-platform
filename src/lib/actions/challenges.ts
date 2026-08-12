"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { type RoutineActionState } from "./routineState";

// ============================================================================
// MEMBER participation actions. Writes go to the `private` schema behind
// own-rows-only RLS (auth.uid() = user_id) -- the role check here is just for a
// friendly message, never the boundary. The challenge/day the member points at
// is always re-derived and re-authorised through the `public` client's RLS
// (drafts are invisible), so a client can't enrol in or complete something it
// can't see, and can't desync the denormalised challenge_id on a completion.
// ============================================================================

const uuid = z.string().uuid();

/** Enrol the caller in a published challenge. Idempotent. */
export async function enrollInChallenge(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();
  const parsed = uuid.safeParse(formData.get("challengeId"));
  if (!parsed.success) return { status: "error", message: "That challenge could not be found." };
  const challengeId = parsed.data;

  try {
    const supabase = await createClient();
    // RLS hides drafts, so a hit here also proves the challenge is joinable.
    const { data: challenge } = await supabase
      .from("challenges")
      .select("id")
      .eq("id", challengeId)
      .maybeSingle();
    if (!challenge) return { status: "error", message: "That challenge isn’t available." };

    const privateClient = await createClient("private");
    const { error } = await privateClient
      .from("challenge_enrollments")
      .upsert({ user_id: session.userId, challenge_id: challengeId }, {
        onConflict: "user_id,challenge_id",
        ignoreDuplicates: true,
      });
    if (error) return { status: "error", message: "Couldn’t join right now. Please try again." };
  } catch {
    return { status: "error", message: "Couldn’t join right now. Please try again." };
  }

  revalidatePath(`/challenges/${challengeId}`);
  revalidatePath("/challenges");
  return { status: "success" };
}

/** Leave a challenge. Completions are intentionally kept, so re-joining resumes. */
export async function leaveChallenge(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();
  const parsed = uuid.safeParse(formData.get("challengeId"));
  if (!parsed.success) return { status: "error", message: "That challenge could not be found." };
  const challengeId = parsed.data;

  try {
    const privateClient = await createClient("private");
    const { error } = await privateClient
      .from("challenge_enrollments")
      .delete()
      .eq("user_id", session.userId)
      .eq("challenge_id", challengeId);
    if (error) return { status: "error", message: "Couldn’t leave right now. Please try again." };
  } catch {
    return { status: "error", message: "Couldn’t leave right now. Please try again." };
  }

  revalidatePath(`/challenges/${challengeId}`);
  revalidatePath("/challenges");
  return { status: "success" };
}

/** Tick or un-tick a single day. `challenge_id` is derived from the day, never trusted from the client. */
export async function setChallengeDayDone(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();
  const parsed = z
    .object({ challengeDayId: uuid, done: z.enum(["true", "false"]) })
    .safeParse({ challengeDayId: formData.get("challengeDayId"), done: formData.get("done") });
  if (!parsed.success) return { status: "error", message: "Something went wrong. Please try again." };
  const { challengeDayId, done } = parsed.data;

  let challengeId: string;
  try {
    const supabase = await createClient();
    // RLS: readable only if the parent challenge is published -- so a member can
    // only ever complete a day they can actually see.
    const { data: day } = await supabase
      .from("challenge_days")
      .select("id, challenge_id")
      .eq("id", challengeDayId)
      .maybeSingle();
    if (!day) return { status: "error", message: "That day isn’t available." };
    challengeId = (day as { challenge_id: string }).challenge_id;

    const privateClient = await createClient("private");
    if (done === "true") {
      const { error } = await privateClient
        .from("challenge_day_completions")
        .upsert(
          { user_id: session.userId, challenge_day_id: challengeDayId, challenge_id: challengeId },
          { onConflict: "user_id,challenge_day_id", ignoreDuplicates: true }
        );
      if (error) return { status: "error", message: "Couldn’t save that. Please try again." };
    } else {
      const { error } = await privateClient
        .from("challenge_day_completions")
        .delete()
        .eq("user_id", session.userId)
        .eq("challenge_day_id", challengeDayId);
      if (error) return { status: "error", message: "Couldn’t save that. Please try again." };
    }
  } catch {
    return { status: "error", message: "Couldn’t save that. Please try again." };
  }

  revalidatePath(`/challenges/${challengeId}`);
  revalidatePath("/challenges");
  return { status: "success" };
}

// ============================================================================
// ADMIN (ntitt_admin) authoring actions -- the Studio side. Same defence-in-
// depth as lib/actions/content.ts: the role is checked here for a message, the
// challenges/challenge_days INSERT RLS policies are the real boundary (verified
// live by the migration harness).
// ============================================================================

async function ensureNtittAdmin(): Promise<RoutineActionState | null> {
  const profile = await getProfile();
  if (profile.role !== "ntitt_admin") {
    return { status: "error", message: "You don’t have access to challenge authoring." };
  }
  return null;
}

const CreateChallengeSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(1000).optional(),
  category: z.enum(["mental_fitness", "physical_fitness", "nutrition", "tools_tips"]),
  lengthDays: z.number().int().min(1).max(366),
  publish: z.enum(["true", "false"]).optional(),
});

export async function createChallenge(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();
  const denied = await ensureNtittAdmin();
  if (denied) return denied;

  const rawLen = formData.get("lengthDays");
  const parsed = CreateChallengeSchema.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary") || undefined,
    category: formData.get("category"),
    lengthDays: rawLen ? Number(rawLen) : undefined,
    publish: formData.get("publish") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the fields and try again." };
  }
  const data = parsed.data;

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("challenges").insert({
      title: data.title,
      summary: data.summary ?? null,
      category: data.category,
      length_days: data.lengthDays,
      is_published: data.publish === "true",
      created_by: session.userId,
    });
    if (error) return { status: "error", message: "Something went wrong saving this. Please try again." };
  } catch {
    return { status: "error", message: "Something went wrong saving this. Please try again." };
  }

  revalidatePath("/community/admin/challenges");
  revalidatePath("/challenges");
  return { status: "success" };
}

const AddDaySchema = z.object({
  challengeId: uuid,
  dayIndex: z.number().int().min(1).max(366),
  contentItemId: uuid.optional(),
  prompt: z.string().trim().max(1000).optional(),
});

export async function addChallengeDay(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await verifySession();
  const denied = await ensureNtittAdmin();
  if (denied) return denied;

  const rawDay = formData.get("dayIndex");
  const rawContent = formData.get("contentItemId");
  const parsed = AddDaySchema.safeParse({
    challengeId: formData.get("challengeId"),
    dayIndex: rawDay ? Number(rawDay) : undefined,
    contentItemId: rawContent && rawContent !== "" ? rawContent : undefined,
    prompt: formData.get("prompt") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the day details." };
  }
  const data = parsed.data;
  if (!data.contentItemId && !data.prompt) {
    return { status: "error", message: "Add a content item, a prompt, or both for this day." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("challenge_days").insert({
      challenge_id: data.challengeId,
      day_index: data.dayIndex,
      content_item_id: data.contentItemId ?? null,
      prompt: data.prompt ?? null,
    });
    if (error) {
      // The unique (challenge_id, day_index) constraint is the likely culprit.
      return { status: "error", message: "Couldn’t add that day — is the day number already used?" };
    }
  } catch {
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  revalidatePath(`/community/admin/challenges/${data.challengeId}`);
  revalidatePath(`/challenges/${data.challengeId}`);
  return { status: "success" };
}

export async function deleteChallengeDay(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await verifySession();
  const denied = await ensureNtittAdmin();
  if (denied) return denied;

  const parsed = z
    .object({ challengeId: uuid, dayId: uuid })
    .safeParse({ challengeId: formData.get("challengeId"), dayId: formData.get("dayId") });
  if (!parsed.success) return { status: "error", message: "Something went wrong. Please try again." };

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("challenge_days").delete().eq("id", parsed.data.dayId);
    if (error) return { status: "error", message: "Couldn’t remove that day. Please try again." };
  } catch {
    return { status: "error", message: "Couldn’t remove that day. Please try again." };
  }

  revalidatePath(`/community/admin/challenges/${parsed.data.challengeId}`);
  revalidatePath(`/challenges/${parsed.data.challengeId}`);
  return { status: "success" };
}

export async function setChallengePublished(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await verifySession();
  const denied = await ensureNtittAdmin();
  if (denied) return denied;

  const parsed = z
    .object({ challengeId: uuid, publish: z.enum(["true", "false"]) })
    .safeParse({ challengeId: formData.get("challengeId"), publish: formData.get("publish") });
  if (!parsed.success) return { status: "error", message: "Something went wrong. Please try again." };

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("challenges")
      .update({ is_published: parsed.data.publish === "true" })
      .eq("id", parsed.data.challengeId);
    if (error) return { status: "error", message: "Couldn’t update that. Please try again." };
  } catch {
    return { status: "error", message: "Couldn’t update that. Please try again." };
  }

  revalidatePath(`/community/admin/challenges/${parsed.data.challengeId}`);
  revalidatePath("/community/admin/challenges");
  revalidatePath("/challenges");
  return { status: "success" };
}
