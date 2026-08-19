"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { uploadNoticeImage } from "@/lib/notices/imageUpload";
import {
  createNoticeVideoUploadTarget,
  isNoticeVideoPath,
  NOTICE_VIDEO_BUCKET,
} from "@/lib/notices/videoUpload";
import {
  validateNoticeFields,
  normaliseVimeoId,
  type NoticeFieldValues,
} from "@/lib/notices/validation";
import type { NoticeMediaKind } from "@/types/database";
import { type NoticeFormState } from "@/lib/notices/noticeFormState";
import { type RoutineActionState } from "./routineState";

const NOTICE_MEDIA_BUCKET = "notice-media";

/** The raw values read off the authoring form. Image files stream through the
 *  action; video files are uploaded direct-to-Storage first, so the form only
 *  carries the resulting `videoPath` (validated against our own path shape). */
type NoticeFormInput = Omit<NoticeFieldValues, "hasImage" | "hasVideo"> & {
  publish: boolean;
  priority: number;
  videoPath: string | null;
};

function readNoticeForm(formData: FormData): NoticeFormInput {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const priorityRaw = Number(str("priority"));
  const videoPathRaw = str("videoPath");
  return {
    title: str("title"),
    body: str("body"),
    mediaKind: (str("mediaKind") || "none") as NoticeMediaKind,
    vimeoId: str("vimeoId"),
    videoPath: videoPathRaw && isNoticeVideoPath(videoPathRaw) ? videoPathRaw : null,
    weekday: str("weekday"),
    startsOn: str("startsOn"),
    endsOn: str("endsOn"),
    ctaLabel: str("ctaLabel"),
    ctaUrl: str("ctaUrl"),
    publish: formData.get("publish") === "true",
    priority: Number.isInteger(priorityRaw) ? Math.min(Math.max(priorityRaw, 0), 1000) : 0,
  };
}

/** Map the validated form input + resolved media paths to a `notices` row. */
function toNoticeRow(input: NoticeFormInput, media: { imagePath: string | null; videoPath: string | null }) {
  const ctaUrl = input.ctaUrl || null;
  return {
    title: input.title,
    body: input.body || null,
    media_kind: input.mediaKind,
    vimeo_id: input.mediaKind === "vimeo" ? normaliseVimeoId(input.vimeoId) : null,
    image_path: input.mediaKind === "image" ? media.imagePath : null,
    video_path: input.mediaKind === "video" ? media.videoPath : null,
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

/** Best-effort delete of orphaned Storage objects after a save. Never throws --
 *  a stray object is harmless; the row is the operation that matters. */
async function removeOrphans(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  removals: { bucket: string; path: string | null }[]
): Promise<void> {
  for (const { bucket, path } of removals) {
    if (!path) continue;
    try {
      await supabase.storage.from(bucket).remove([path]);
    } catch {
      /* non-fatal */
    }
  }
}

/**
 * Mint a signed upload URL so the browser can PUT a video file straight to
 * Storage, bypassing the Server Action body limit. ntitt_admin only (the real
 * gate is the notice-videos INSERT RLS, which creating the signed URL is subject
 * to). Called directly from the Studio form with the picked file's content type.
 */
export async function createNoticeVideoUpload(input: {
  contentType: string;
}): Promise<{ path: string; token: string } | { error: string }> {
  await verifySession();
  const profile = await getProfile();
  if (profile.role !== "ntitt_admin") {
    return { error: "You don’t have access to the notice board." };
  }
  try {
    const supabase = await createClient();
    return await createNoticeVideoUploadTarget(supabase, input.contentType);
  } catch {
    return { error: "Couldn’t start the video upload. Please try again." };
  }
}

/**
 * Create a Notice Board card from the Super Admin Studio. ntitt_admin only: the
 * role is checked here for a friendly message, but the real boundary is the
 * notices INSERT RLS policy (ntitt_admin-gated), verified live by the migration
 * harness -- the same defense-in-depth pattern as createContentItem.
 *
 * Media is validated per kind against the shape the table's CHECK enforces:
 * 'vimeo' needs a numeric id; 'image' needs an uploaded file (to notice-media);
 * 'video' needs an already-uploaded file path (streamed direct to notice-videos
 * from the browser, see createNoticeVideoUpload); 'none' carries none. Returns
 * per-field errors so the controlled form highlights the exact field(s) at fault
 * instead of wiping.
 */
export async function createNotice(_prev: NoticeFormState, formData: FormData): Promise<NoticeFormState> {
  const session = await verifySession();
  const profile = await getProfile();
  if (profile.role !== "ntitt_admin") {
    return { status: "error", message: "You don’t have access to the notice board." };
  }

  const input = readNoticeForm(formData);

  const file = formData.get("image");
  const hasNewFile = file instanceof File && file.size > 0;
  const fieldErrors = validateNoticeFields({
    ...input,
    hasImage: input.mediaKind === "image" && hasNewFile,
    hasVideo: input.mediaKind === "video" && !!input.videoPath,
  });
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
      ...toNoticeRow(input, { imagePath, videoPath: input.videoPath }),
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
 * RLS policy is the real gate). Handles the things an update must do that a
 * create doesn't: switch media columns when the kind changes, keep the existing
 * image/video when the kind is unchanged and no new file is picked, and
 * orphan-clean the old object when it's replaced or the kind moves away from it.
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
  const file = formData.get("image");
  const hasNewFile = file instanceof File && file.size > 0;

  try {
    const supabase = await createClient();

    const { data: current, error: loadError } = await supabase
      .from("notices")
      .select("media_kind, image_path, video_path")
      .eq("id", id)
      .maybeSingle();
    if (loadError || !current) {
      return { status: "error", message: "Couldn’t find that notice to edit." };
    }
    const currentImagePath = (current as { image_path: string | null }).image_path;
    const currentVideoPath = (current as { video_path: string | null }).video_path;

    // The video may be a fresh upload (input.videoPath differs) or the kept one.
    const nextVideoPath =
      input.mediaKind === "video" ? input.videoPath ?? currentVideoPath : null;

    const hasImage = input.mediaKind === "image" && (hasNewFile || !!currentImagePath);
    const hasVideo = input.mediaKind === "video" && !!nextVideoPath;
    const fieldErrors = validateNoticeFields({ ...input, hasImage, hasVideo });
    if (Object.keys(fieldErrors).length > 0) {
      return { status: "error", fieldErrors };
    }

    // Resolve the image column (upload a new file if given, else keep existing).
    let imagePath: string | null = null;
    if (input.mediaKind === "image") {
      if (hasNewFile) {
        const result = await uploadNoticeImage(supabase, file as File);
        if ("error" in result) return { status: "error", fieldErrors: { image: result.error } };
        imagePath = result.path;
      } else {
        imagePath = currentImagePath; // kept
      }
    }

    const { error } = await supabase
      .from("notices")
      .update(toNoticeRow(input, { imagePath, videoPath: nextVideoPath }))
      .eq("id", id);
    if (error) {
      console.error("updateNotice: update failed", error);
      return { status: "error", message: "Something went wrong saving this. Please try again." };
    }

    // Best-effort orphan cleanup: bin any old object the row no longer points at
    // (replaced media, or a kind change away from image/video).
    await removeOrphans(supabase, [
      { bucket: NOTICE_MEDIA_BUCKET, path: currentImagePath !== imagePath ? currentImagePath : null },
      { bucket: NOTICE_VIDEO_BUCKET, path: currentVideoPath !== nextVideoPath ? currentVideoPath : null },
    ]);
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
 * Delete a notice. ntitt_admin only. Best-effort removes the uploaded image /
 * video object too (an orphan in the bucket is harmless but tidy to clear); the
 * row delete is the operation that matters.
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
      .select("image_path, video_path")
      .eq("id", parsed.data.id)
      .maybeSingle();

    const { error } = await supabase.from("notices").delete().eq("id", parsed.data.id);
    if (error) return { status: "error", message: "Couldn’t delete that notice. Please try again." };

    const row = current as { image_path: string | null; video_path: string | null } | null;
    await removeOrphans(supabase, [
      { bucket: NOTICE_MEDIA_BUCKET, path: row?.image_path ?? null },
      { bucket: NOTICE_VIDEO_BUCKET, path: row?.video_path ?? null },
    ]);
  } catch {
    return { status: "error", message: "Couldn’t delete that notice. Please try again." };
  }

  revalidatePath("/admin/notices");
  revalidatePath("/home");
  return { status: "success" };
}
