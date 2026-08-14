"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { uploadContentAsset } from "@/lib/content/assetUpload";
import { type RoutineActionState } from "./routineState";

const ContentSchema = z.object({
  type: z.enum(["video", "document", "image"]),
  title: z.string().trim().min(1).max(200),
  category: z.enum(["mental_fitness", "physical_fitness", "nutrition", "tools_tips"]),
  summary: z.string().trim().max(1000).optional(),
  dayOfWeek: z.number().int().min(1).max(7).optional(),
  vimeoId: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter the numeric Vimeo ID only (e.g. 123456789), not a URL.")
    .max(64)
    .optional(),
  externalUrl: z
    .string()
    .trim()
    .regex(/^https?:\/\/.+/i, "Enter a valid http(s) link.")
    .max(2000)
    .optional(),
  tags: z.string().max(500).optional(),
  publish: z.enum(["true", "false"]).optional(),
});

/**
 * Create a content item from the Super Admin Studio (see
 * docs/CONTENT_PLATFORM_STRATEGY.md "Pillar 6"). ntitt_admin only: the role is
 * checked here for a friendly message, but the real boundary is the
 * content_items INSERT RLS policy (ntitt_admin-gated), verified live by the
 * migration harness -- the same defense-in-depth pattern as every other action
 * in this codebase.
 *
 * Media is validated per type against the same shape the table's CHECK
 * constraint enforces: a video needs a Vimeo id; a document/image needs either
 * an uploaded asset (to the content-assets bucket) or an external URL. Channel
 * placements are optional -- NONE means NTITT-wide (visible to every company);
 * one row per selected company targets it there.
 */
export async function createContentItem(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();
  const profile = await getProfile();
  if (profile.role !== "ntitt_admin") {
    return { status: "error", message: "You don’t have access to the content studio." };
  }

  const rawDay = formData.get("dayOfWeek");
  const parsed = ContentSchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title"),
    category: formData.get("category"),
    summary: formData.get("summary") || undefined,
    dayOfWeek: rawDay && rawDay !== "" ? Number(rawDay) : undefined,
    vimeoId: formData.get("vimeoId") || undefined,
    externalUrl: formData.get("externalUrl") || undefined,
    tags: formData.get("tags") || undefined,
    publish: formData.get("publish") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the fields and try again." };
  }
  const data = parsed.data;

  // Channel placements: company ids the item is targeted to (empty = global).
  const channelsRaw = formData.getAll("channels").map(String).filter((v) => v.length > 0);
  const channelsParsed = z.array(z.string().uuid()).safeParse(channelsRaw);
  if (!channelsParsed.success) {
    return { status: "error", message: "Something went wrong with the selected channels. Please try again." };
  }
  const channels = channelsParsed.data;

  const tags = (data.tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  try {
    const supabase = await createClient();

    // Per-type media, matching the table CHECK constraint.
    let assetPath: string | null = null;
    if (data.type === "video") {
      if (!data.vimeoId) {
        return { status: "error", message: "Add the Vimeo ID for a video." };
      }
    } else {
      const asset = formData.get("asset");
      if (asset instanceof File && asset.size > 0) {
        const result = await uploadContentAsset(supabase, asset, data.type);
        if ("error" in result) {
          return { status: "error", message: result.error };
        }
        assetPath = result.path;
      }
      if (!assetPath && !data.externalUrl) {
        return { status: "error", message: "Add a file to upload or an external link." };
      }
    }

    const { data: inserted, error } = await supabase
      .from("content_items")
      .insert({
        type: data.type,
        title: data.title,
        summary: data.summary ?? null,
        category: data.category,
        day_of_week: data.dayOfWeek ?? null,
        vimeo_id: data.type === "video" ? data.vimeoId : null,
        asset_path: assetPath,
        external_url: data.type === "video" ? null : data.externalUrl ?? null,
        tags,
        is_published: data.publish === "true",
        created_by: session.userId,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      return { status: "error", message: "Something went wrong saving this. Please try again." };
    }

    if (channels.length > 0) {
      const rows = channels.map((companyId) => ({ content_item_id: inserted.id, company_id: companyId }));
      const { error: placementError } = await supabase.from("content_channel_placements").insert(rows);
      if (placementError) {
        // The item saved; only the targeting failed. Say so honestly rather
        // than reporting a clean success or a total failure.
        return {
          status: "error",
          message: "Saved the content, but couldn’t set its channels. Delete it and recreate it to try again.",
        };
      }
    }
  } catch {
    return { status: "error", message: "Something went wrong saving this. Please try again." };
  }

  revalidatePath("/admin/content");
  revalidatePath("/content");
  return { status: "success" };
}

const ContentPublishSchema = z.object({
  id: z.string().uuid(),
  published: z.enum(["true", "false"]),
});

/**
 * Publish / unpublish an existing content item. ntitt_admin only (friendly check
 * here; the content_items UPDATE RLS policy is the real gate). Lets a bad or
 * out-of-date piece be pulled from members without deleting it -- there was
 * previously no way to change is_published after creation.
 */
export async function setContentItemPublished(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await verifySession();
  const profile = await getProfile();
  if (profile.role !== "ntitt_admin") {
    return { status: "error", message: "You don’t have access to the content studio." };
  }

  const parsed = ContentPublishSchema.safeParse({
    id: formData.get("id"),
    published: formData.get("published"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Couldn’t update that item." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("content_items")
      .update({ is_published: parsed.data.published === "true" })
      .eq("id", parsed.data.id);
    if (error) {
      return { status: "error", message: "Couldn’t update that item. Please try again." };
    }
  } catch {
    return { status: "error", message: "Couldn’t update that item. Please try again." };
  }

  revalidatePath("/admin/content");
  revalidatePath("/content");
  return { status: "success" };
}

const ContentIdSchema = z.object({ id: z.string().uuid() });

/**
 * Delete a content item. ntitt_admin only. Its channel placements cascade away
 * (FK on delete cascade) and any challenge day pointing at it degrades to a bare
 * prompt (FK on delete set null), so deleting a piece never breaks a challenge.
 * This is the in-app fix for a mistyped Vimeo ID / wrong item that previously
 * needed raw SQL.
 */
export async function deleteContentItem(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await verifySession();
  const profile = await getProfile();
  if (profile.role !== "ntitt_admin") {
    return { status: "error", message: "You don’t have access to the content studio." };
  }

  const parsed = ContentIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { status: "error", message: "Couldn’t delete that item." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("content_items").delete().eq("id", parsed.data.id);
    if (error) {
      return { status: "error", message: "Couldn’t delete that item. Please try again." };
    }
  } catch {
    return { status: "error", message: "Couldn’t delete that item. Please try again." };
  }

  revalidatePath("/admin/content");
  revalidatePath("/content");
  return { status: "success" };
}
