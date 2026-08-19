"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { uploadNoticeImage } from "@/lib/notices/imageUpload";
import {
  validateNoticeFields,
  normaliseVimeoId,
  type NoticeFieldValues,
} from "@/lib/notices/validation";
import type { NoticeMediaKind } from "@/types/database";
import { type NoticeFormState } from "@/lib/notices/noticeFormState";
import { type RoutineActionState } from "./routineState";

const NOTICE_MEDIA_BUCKET = "notice-media";

/** The raw values read off the authoring form (media file handled separately). */
type NoticeFormInput = Omit<NoticeFieldValues, "hasImage"> & { publish: boolean; priority: number };

function readNoticeForm(formData: FormData): NoticeFormInput {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const priorityRaw = Number(str("priority"));
  return {
    title: str("title"),
    body: str("body"),
    mediaKind: (str("mediaKind") || "none") as NoticeMediaKind,
    vimeoId: str("vimeoId"),
    weekday: str("weekday"),
    startsOn: str("startsOn"),
    endsOn: str("endsOn"),
    ctaLabel: str("ctaLabel"),
    ctaUrl: str("ctaUrl"),
    publish: formData.get("publish") === "true",
    priority: Number.isInteger(priorityRaw) ? Math.min(Math.max(priorityRaw, 0), 1000) : 0,
  };
}

/** Map the validated form input + resolved image path to a `notices` row. */
function toNoticeRow(input: NoticeFormInput, imagePath: string | null) {
  const ctaUrl = input.ctaUrl || null;
  return {
    title: input.title,
    body: input.body || null,
    media_kind: input.mediaKind,
    vimeo_id: input.mediaKind === "vimeo" ? normaliseVimeoId(input.vimeoId) : null,
    image_path: input.mediaKind === "image" ? imagePath : null,
    // video_path is the PR2 fast-follow; never written here.
    video_path: null,
    // A label with no link is meaningless (and the DB CHECK forbids it).
    cta_url: ctaUrl,
    cta_label: ctaUrl ? input.ctaLabel || null : null,
    weekday: input.weekday ? Number(input.weekday) : null,
    starts_on: input.startsOn || null,
    ends_on: input.endsOn || null,
    is_published: input.publish,
    priority: input.priority,
  };
}

/**
 * Create a Notice Board card from the Super Admin Studio. ntitt_admin only: the
 * role is checked here for a friendly message, but the real boundary is the
 * notices INSERT RLS policy (ntitt_admin-gated), verified live by the migration
 * harness -- the same defense-in-depth pattern as createContentItem.
 *
 * Media is validated per kind against the shape the table's CHECK enforces:
 * 'vimeo' needs a numeric id; 'image' needs an uploaded file (to notice-media);
 * 'none' carries none. Uploaded VIDEO files are the PR2 fast-follow and rejected
 * here. Returns per-field errors so the controlled form highlights the exact
 * field(s) at fault instead of wiping.
 */
export async function createNotice(_prev: NoticeFormState, formData: FormData): Promise<NoticeFormState> {
  const session = await verifySession();
  const profile = await getProfile();
  if (profile.role !== "ntitt_admin") {
    return { status: "error", message: "You don’t have access to the notice board." };
  }

  const input = readNoticeForm(formData);
  if (input.mediaKind === "video") {
    return { status: "error", message: "Uploaded video notices aren’t available yet — use a Vimeo ID for now." };
  }

  const file = formData.get("image");
  const hasNewFile = file instanceof File && file.size > 0;
  const fieldErrors = validateNoticeFields({ ...input, hasImage: input.mediaKind === "image" && hasNewFile });
  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", fieldErrors };
  }

  try {
    const supabase = await createClient();

    let imagePath: string | null = null;
    if (input.mediaKind === "image" && hasNewFile) {
      const result = await uploadNoticeImage(supabase, file as File);
      if ("error" in result) {
        return { status: "error", fieldErrors: { image: result.error } };
      }
      imagePath = result.path;
    }

    const { error } = await supabase.from("notices").insert({
      ...toNoticeRow(input, imagePath),
      created_by: session.userId,
    });
    if (error) {
      console.error("createNotice: insert failed", error);
      return { status: "error", message: "Something went wrong saving this. Please try again." };
    }
  } catch (err) {
    console.error("createNotice: unexpected error", err);
    return { status: "error", message: "Something went wrong saving this. Please try again." };
  }

  revalidatePath("/admin/notices");
  revalidatePath("/home");
  return { status: "success" };
}

const NoticeIdSchema = z.object({ id: z.string().uuid() });

/**
 * Edit an existing notice. ntitt_admin only (friendly check; the notices UPDATE
 * RLS policy is the real gate). Handles the three things an update must do that a
 * create doesn't: switch media columns when the kind changes, keep the existing
 * image when the kind stays 'image' and no new file is picked, and orphan-clean
 * the old image object when it's replaced or the kind moves away from image.
 * Redirects back to the Studio on success.
 */
export async function updateNotice(_prev: NoticeFormState, formData: FormData): Promise<NoticeFormState> {
  await verifySession();
  const profile = await getProfile();
  if (profile.role !== "ntitt_admin") {
    return { status: "error", message: "You don’t have access to the notice board." };
  }

  const idParsed = NoticeIdSchema.safeParse({ id: formData.get("id") });
  if (!idParsed.success) return { status: "error", message: "Couldn’t find that notice to edit." };
  const id = idParsed.data.id;

  const input = readNoticeForm(formData);
  if (input.mediaKind === "video") {
    return { status: "error", message: "Uploaded video notices aren’t available yet — use a Vimeo ID for now." };
  }

  const file = formData.get("image");
  const hasNewFile = file instanceof File && file.size > 0;

  try {
    const supabase = await createClient();

    const { data: current, error: loadError } = await supabase
      .from("notices")
      .select("media_kind, image_path")
      .eq("id", id)
      .maybeSingle();
    if (loadError || !current) {
      return { status: "error", message: "Couldn’t find that notice to edit." };
    }
    const currentImagePath = (current as { image_path: string | null }).image_path;

    const hasImage = input.mediaKind === "image" && (hasNewFile || !!currentImagePath);
    const fieldErrors = validateNoticeFields({ ...input, hasImage });
    if (Object.keys(fieldErrors).length > 0) {
      return { status: "error", fieldErrors };
    }

    // Resolve the image column + which old object (if any) to orphan-clean.
    let imagePath: string | null = null;
    let removeImagePath: string | null = null;
    if (input.mediaKind === "image") {
      if (hasNewFile) {
        const result = await uploadNoticeImage(supabase, file as File);
        if ("error" in result) return { status: "error", fieldErrors: { image: result.error } };
        imagePath = result.path;
        removeImagePath = currentImagePath; // replaced
      } else {
        imagePath = currentImagePath; // kept
      }
    } else if (currentImagePath) {
      removeImagePath = currentImagePath; // media kind moved away from image
    }

    const { error } = await supabase.from("notices").update(toNoticeRow(input, imagePath)).eq("id", id);
    if (error) {
      console.error("updateNotice: update failed", error);
      return { status: "error", message: "Something went wrong saving this. Please try again." };
    }

    // Best-effort orphan cleanup now the row no longer points at the old object.
    if (removeImagePath) {
      await supabase.storage.from(NOTICE_MEDIA_BUCKET).remove([removeImagePath]);
    }
  } catch (err) {
    console.error("updateNotice: unexpected error", err);
    return { status: "error", message: "Something went wrong saving this. Please try again." };
  }

  revalidatePath("/admin/notices");
  revalidatePath("/home");
  redirect("/admin/notices");
}

const NoticePublishSchema = z.object({
  id: z.string().uuid(),
  published: z.enum(["true", "false"]),
});

/** Publish / unpublish a notice without deleting it. ntitt_admin only. */
export async function setNoticePublished(
  _prev: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await verifySession();
  const profile = await getProfile();
  if (profile.role !== "ntitt_admin") {
    return { status: "error", message: "You don’t have access to the notice board." };
  }

  const parsed = NoticePublishSchema.safeParse({
    id: formData.get("id"),
    published: formData.get("published"),
  });
  if (!parsed.success) return { status: "error", message: "Couldn’t update that notice." };

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("notices")
      .update({ is_published: parsed.data.published === "true" })
      .eq("id", parsed.data.id);
    if (error) return { status: "error", message: "Couldn’t update that notice. Please try again." };
  } catch {
    return { status: "error", message: "Couldn’t update that notice. Please try again." };
  }

  revalidatePath("/admin/notices");
  revalidatePath("/home");
  return { status: "success" };
}

/**
 * Delete a notice. ntitt_admin only. Best-effort removes the uploaded image
 * object first (an orphan in the bucket is harmless but tidy to clear); the row
 * delete is the operation that matters.
 */
export async function deleteNotice(_prev: RoutineActionState, formData: FormData): Promise<RoutineActionState> {
  await verifySession();
  const profile = await getProfile();
  if (profile.role !== "ntitt_admin") {
    return { status: "error", message: "You don’t have access to the notice board." };
  }

  const parsed = NoticeIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { status: "error", message: "Couldn’t delete that notice." };

  try {
    const supabase = await createClient();
    const { data: current } = await supabase
      .from("notices")
      .select("image_path")
      .eq("id", parsed.data.id)
      .maybeSingle();

    const { error } = await supabase.from("notices").delete().eq("id", parsed.data.id);
    if (error) return { status: "error", message: "Couldn’t delete that notice. Please try again." };

    const path = (current as { image_path: string | null } | null)?.image_path;
    if (path) {
      await supabase.storage.from(NOTICE_MEDIA_BUCKET).remove([path]);
    }
  } catch {
    return { status: "error", message: "Couldn’t delete that notice. Please try again." };
  }

  revalidatePath("/admin/notices");
  revalidatePath("/home");
  return { status: "success" };
}
