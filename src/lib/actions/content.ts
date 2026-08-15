"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { uploadContentAsset } from "@/lib/content/assetUpload";
import { resolveContentMediaUpdate } from "@/lib/content/contentMedia";
import {
  ContentInputSchema,
  parseContentImportCsv,
  type ContentImportState,
} from "@/lib/content/csvImport";
import { type RoutineActionState } from "./routineState";

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
  const parsed = ContentInputSchema.safeParse({
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

const ContentEditSchema = z.object({ id: z.string().uuid() });

/**
 * Edit an existing content item from the Studio (the counterpart to
 * createContentItem -- previously only create/delete/publish existed, so fixing
 * a typo meant delete + recreate). ntitt_admin only (friendly check here; the
 * content_items UPDATE RLS policy is the real gate). Reuses the single-source
 * ContentInputSchema, so the same validation as create + the importer.
 *
 * Three things an update must do that a create doesn't (see
 * lib/content/contentMedia.ts resolveContentMediaUpdate, which is unit-tested):
 *   1. Media/type change -- write mutually-exclusive vimeo_id / asset_path /
 *      external_url so the content_items_media_for_type CHECK holds when the type
 *      flips (e.g. video -> document).
 *   2. "Media unchanged" -- keep the existing asset when no new file/URL is given.
 *   3. Orphan cleanup -- delete a replaced asset object from content-assets.
 * Channel placements are reconciled (delete-all + re-insert the selected set;
 * zero rows = NTITT-wide). Redirects back to the Studio on success.
 */
export async function updateContentItem(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await verifySession();
  const profile = await getProfile();
  if (profile.role !== "ntitt_admin") {
    return { status: "error", message: "You don’t have access to the content studio." };
  }

  const idParsed = ContentEditSchema.safeParse({ id: formData.get("id") });
  if (!idParsed.success) {
    return { status: "error", message: "Couldn’t find that item to edit." };
  }
  const id = idParsed.data.id;

  const rawDay = formData.get("dayOfWeek");
  const parsed = ContentInputSchema.safeParse({
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

    // The current row is needed to reconcile media (keep-existing) and to know
    // which old asset to orphan on a replace.
    const { data: current, error: loadError } = await supabase
      .from("content_items")
      .select("type, asset_path, external_url, vimeo_id")
      .eq("id", id)
      .maybeSingle();
    if (loadError || !current) {
      return { status: "error", message: "Couldn’t find that item to edit." };
    }

    // Upload a new file first (if any), then let the pure resolver decide the
    // three media columns for the (possibly changed) type.
    let newAssetPath: string | null = null;
    if (data.type !== "video") {
      const asset = formData.get("asset");
      if (asset instanceof File && asset.size > 0) {
        const result = await uploadContentAsset(supabase, asset, data.type);
        if ("error" in result) {
          return { status: "error", message: result.error };
        }
        newAssetPath = result.path;
      }
    }

    const media = resolveContentMediaUpdate({
      newType: data.type,
      vimeoId: data.type === "video" ? data.vimeoId ?? null : null,
      externalUrl: data.type === "video" ? null : data.externalUrl ?? null,
      newAssetPath,
      current: current as {
        type: typeof data.type;
        asset_path: string | null;
        external_url: string | null;
        vimeo_id: string | null;
      },
    });
    if (!media.ok) {
      return { status: "error", message: media.error };
    }

    const { error } = await supabase
      .from("content_items")
      .update({
        type: data.type,
        title: data.title,
        summary: data.summary ?? null,
        category: data.category,
        day_of_week: data.dayOfWeek ?? null,
        vimeo_id: media.vimeo_id,
        asset_path: media.asset_path,
        external_url: media.external_url,
        tags,
        is_published: data.publish === "true",
      })
      .eq("id", id);
    if (error) {
      console.error("updateContentItem: update failed", error);
      return { status: "error", message: "Something went wrong saving this. Please try again." };
    }

    // Reconcile channel placements to exactly the selected set.
    const { error: delError } = await supabase
      .from("content_channel_placements")
      .delete()
      .eq("content_item_id", id);
    if (delError) {
      return { status: "error", message: "Saved the content, but couldn’t update its channels. Please try again." };
    }
    if (channels.length > 0) {
      const rows = channels.map((companyId) => ({ content_item_id: id, company_id: companyId }));
      const { error: insError } = await supabase.from("content_channel_placements").insert(rows);
      if (insError) {
        return { status: "error", message: "Saved the content, but couldn’t set its channels. Please try again." };
      }
    }

    // Best-effort: delete the orphaned old asset now the row no longer points at
    // it. A failure here just leaves a stray object; it never fails the edit.
    if (media.removeAsset) {
      await supabase.storage.from("content-assets").remove([media.removeAsset]);
    }
  } catch (err) {
    console.error("updateContentItem: unexpected error", err);
    return { status: "error", message: "Something went wrong saving this. Please try again." };
  }

  revalidatePath("/admin/content");
  revalidatePath("/content");
  redirect("/admin/content");
}

/**
 * Bulk-import a content catalogue from a CSV (paste or .csv upload). ntitt_admin
 * only (friendly check here; the content_items INSERT RLS policy is the real
 * gate). Validation is single-source -- every row parses through the same
 * ContentInputSchema as the single-add form above -- and all-or-nothing: if ANY
 * row fails, nothing is written, so a bad row never leaves a half-loaded
 * catalogue that would duplicate on a re-run. Imported items are NTITT-wide (no
 * channel targeting) and carry no uploaded assets (a CSV can't hold a binary),
 * so a video row needs a Vimeo id and a document/image row an external URL.
 * Format guide: docs/CONTENT_IMPORT.md.
 */
export async function importContentItems(
  _prevState: ContentImportState,
  formData: FormData
): Promise<ContentImportState> {
  const session = await verifySession();
  const profile = await getProfile();
  if (profile.role !== "ntitt_admin") {
    return { status: "error", message: "You don’t have access to the content studio." };
  }

  // Prefer an uploaded .csv; fall back to the pasted textarea.
  let text = "";
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    text = await file.text();
  } else {
    text = String(formData.get("csv") ?? "");
  }
  if (text.trim() === "") {
    return { status: "error", message: "Paste some CSV or choose a .csv file to import." };
  }

  const defaultPublish = formData.get("defaultPublish") === "true";
  const { rows, errors, fatal, dataRowCount } = parseContentImportCsv(text, { defaultPublish });

  if (fatal) {
    return { status: "error", message: fatal };
  }
  if (errors.length > 0) {
    return {
      status: "error",
      message: `${errors.length} of ${dataRowCount} row${dataRowCount === 1 ? "" : "s"} need fixing — nothing was imported. Fix these and re-upload.`,
      rowErrors: errors,
    };
  }
  if (rows.length === 0) {
    return { status: "error", message: "No content rows found under the header." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("content_items")
      .insert(rows.map((r) => ({ ...r, created_by: session.userId })));
    if (error) {
      return { status: "error", message: "Couldn’t save the imported content. Please try again." };
    }
  } catch {
    return { status: "error", message: "Couldn’t save the imported content. Please try again." };
  }

  revalidatePath("/admin/content");
  revalidatePath("/content");

  const published = rows.filter((r) => r.is_published).length;
  const drafted = rows.length - published;
  return {
    status: "success",
    message: `Imported ${rows.length} item${rows.length === 1 ? "" : "s"} — ${published} live, ${drafted} draft${drafted === 1 ? "" : "s"}.`,
    created: rows.length,
    published,
    drafted,
  };
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
