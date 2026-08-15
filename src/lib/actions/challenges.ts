"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { listAllContentForAdmin } from "@/lib/content/queries";
import {
  parseChallengeImportCsv,
  resolveChallengeContent,
  buildContentIndex,
  type ChallengeImportState,
} from "@/lib/challenges/challengeImport";
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

  revalidatePath("/admin/challenges");
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

  revalidatePath(`/admin/challenges/${data.challengeId}`);
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

  revalidatePath(`/admin/challenges/${parsed.data.challengeId}`);
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

  revalidatePath(`/admin/challenges/${parsed.data.challengeId}`);
  revalidatePath("/admin/challenges");
  revalidatePath("/challenges");
  return { status: "success" };
}

/**
 * Bulk-import a challenge's day sequence from a CSV (paste or .csv upload).
 * ntitt_admin only (friendly check here; the challenge_days INSERT RLS policy is
 * the real gate). The CSV bulk analogue of `addChallengeDay`: it sequences
 * EXISTING content (referenced by title or id, resolved against the admin content
 * list) into days, or writes prompt-only days. Content itself is loaded via the
 * content importer / Studio first, so the two importers compose.
 *
 * All-or-nothing, exactly like `importContentItems`: structural errors, unknown
 * content references, and day numbers that already exist in this challenge each
 * abort the whole import with precise per-row messages, so a re-upload after a
 * fix never partially double-writes. Format guide: docs/CONTENT_IMPORT.md.
 */
export async function importChallengeDays(
  _prev: ChallengeImportState,
  formData: FormData
): Promise<ChallengeImportState> {
  await verifySession();
  const denied = await ensureNtittAdmin();
  if (denied) return { status: "error", message: "You don’t have access to challenge authoring." };

  const challengeIdParsed = uuid.safeParse(formData.get("challengeId"));
  if (!challengeIdParsed.success) return { status: "error", message: "That challenge could not be found." };
  const challengeId = challengeIdParsed.data;

  // Prefer an uploaded .csv; fall back to the pasted textarea.
  let text = "";
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    text = await file.text();
  } else {
    text = String(formData.get("csv") ?? "");
  }
  if (text.trim() === "") return { status: "error", message: "Paste some CSV or choose a .csv file to import." };

  const { rows, errors, fatal, dataRowCount } = parseChallengeImportCsv(text);
  if (fatal) return { status: "error", message: fatal };
  if (errors.length > 0) {
    return {
      status: "error",
      message: `${errors.length} of ${dataRowCount} row${dataRowCount === 1 ? "" : "s"} need fixing — nothing was imported. Fix these and re-upload.`,
      rowErrors: errors,
    };
  }
  if (rows.length === 0) return { status: "error", message: "No day rows found under the header." };

  try {
    const supabase = await createClient();

    // Resolve content references (title or id) against the admin content list,
    // and gather the days already in this challenge -- both are needed before a
    // single all-or-nothing insert.
    const [content, existing] = await Promise.all([
      listAllContentForAdmin(supabase),
      supabase.from("challenge_days").select("day_index").eq("challenge_id", challengeId),
    ]);

    const index = buildContentIndex(content.map((c) => ({ id: c.id, title: c.title })));
    const { resolved, errors: resolveErrors } = resolveChallengeContent(rows, index);
    if (resolveErrors.length > 0) {
      return {
        status: "error",
        message: `${resolveErrors.length} row${resolveErrors.length === 1 ? "" : "s"} reference content that isn’t loaded — nothing was imported. Load the content first (or use its id).`,
        rowErrors: resolveErrors,
      };
    }

    const existingDays = new Set((existing.data ?? []).map((d) => d.day_index as number));
    const conflicts = rows
      .filter((r) => existingDays.has(r.dayIndex))
      .map((r) => ({
        line: r.line,
        message: `Day ${r.dayIndex} already exists in this challenge — remove it from the file, or delete that day first.`,
      }));
    if (conflicts.length > 0) {
      return {
        status: "error",
        message: `${conflicts.length} day${conflicts.length === 1 ? "" : "s"} already exist in this challenge — nothing was imported.`,
        rowErrors: conflicts,
      };
    }

    const { error } = await supabase.from("challenge_days").insert(
      resolved.map((r) => ({
        challenge_id: challengeId,
        day_index: r.day_index,
        content_item_id: r.content_item_id,
        prompt: r.prompt,
      }))
    );
    if (error) return { status: "error", message: "Couldn’t save the imported days. Please try again." };
  } catch {
    return { status: "error", message: "Couldn’t save the imported days. Please try again." };
  }

  revalidatePath(`/admin/challenges/${challengeId}`);
  revalidatePath(`/challenges/${challengeId}`);

  // Every parsed row resolved and inserted (we aborted otherwise), so `rows`
  // counts the import: a non-null contentRef is exactly a day that got content.
  const withContent = rows.filter((r) => r.contentRef).length;
  const promptOnly = rows.length - withContent;
  return {
    status: "success",
    message: `Imported ${rows.length} day${rows.length === 1 ? "" : "s"} — ${withContent} with content, ${promptOnly} prompt-only.`,
    created: rows.length,
    withContent,
    promptOnly,
  };
}
