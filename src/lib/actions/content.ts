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

  // Optional Brain folder to file this new item into (the quick-add composer
  // passes the active folder). Absent/empty = Unfiled. Folder changes for an
  // EXISTING item go through moveItemToFolder, never updateContentItem.
  const folderIdRaw = formData.get("folderId");
  const folderId = typeof folderIdRaw === "string" && folderIdRaw.length > 0 ? folderIdRaw : null;
  if (folderId && !z.string().uuid().safeParse(folderId).success) {
    return { status: "error", message: "Something went wrong with the selected folder. Please try again." };
  }

  // Optional publish date, set when adding straight onto a calendar day. A draft
  // carrying it auto-publishes on that date (publish-scheduled-content cron).
  const scheduledForRaw = formData.get("scheduledFor");
  const scheduledFor =
    typeof scheduledForRaw === "string" && scheduledForRaw.length > 0 ? scheduledForRaw : null;
  if (scheduledFor && !/^\d{4}-\d{2}-\d{2}$/.test(scheduledFor)) {
    return { status: "error", message: "Enter a valid publish date." };
  }

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
    } else if (data.type === "document" || data.type === "image") {
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
    // type === "text": no media at all (title + summary is the whole item).

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
        folder_id: folderId,
        scheduled_for: scheduledFor,
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
  revalidatePath("/admin/brain");
  revalidatePath("/admin/calendar");
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
    if (data.type === "document" || data.type === "image") {
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
  revalidatePath("/admin/brain");
  revalidatePath("/admin/calendar");
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

    // Resolve any `folder` NAMES on the rows to folder ids, creating a folder
    // the first time its name is seen (case-insensitive reuse of an existing
    // one). Lets one CSV lay down the folder structure + file every item, so a
    // bulk load (e.g. Anthony's journal, one folder per day) needs no clicking.
    const wantedFolders = Array.from(
      new Map(rows.filter((r) => r.folder).map((r) => [r.folder!.toLowerCase(), r.folder!])).values()
    );
    const folderIdByLower = new Map<string, string>();
    if (wantedFolders.length > 0) {
      const { data: existing } = await supabase.from("content_folders").select("id, name");
      for (const f of (existing as { id: string; name: string }[] | null) ?? []) {
        folderIdByLower.set(f.name.toLowerCase(), f.id);
      }
      const toCreate = wantedFolders.filter((name) => !folderIdByLower.has(name.toLowerCase()));
      if (toCreate.length > 0) {
        const { data: created, error: folderErr } = await supabase
          .from("content_folders")
          .insert(toCreate.map((name) => ({ name, created_by: session.userId })))
          .select("id, name");
        if (folderErr) {
          return { status: "error", message: "Couldn’t create the folders for the import. Please try again." };
        }
        for (const f of (created as { id: string; name: string }[] | null) ?? []) {
          folderIdByLower.set(f.name.toLowerCase(), f.id);
        }
      }
    }

    // Strip the folder NAME (not a column) and swap in folder_id.
    const insertRows = rows.map(({ folder, ...r }) => ({
      ...r,
      folder_id: folder ? folderIdByLower.get(folder.toLowerCase()) ?? null : null,
      created_by: session.userId,
    }));
    const { error } = await supabase.from("content_items").insert(insertRows);
    if (error) {
      return { status: "error", message: "Couldn’t save the imported content. Please try again." };
    }
  } catch {
    return { status: "error", message: "Couldn’t save the imported content. Please try again." };
  }

  revalidatePath("/admin/content");
  revalidatePath("/admin/brain");
  revalidatePath("/admin/calendar");
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
    const publish = parsed.data.published === "true";
    const { error } = await supabase
      .from("content_items")
      // Unpublishing also clears any pending schedule, so the
      // publish-scheduled-content cron can't re-publish a deliberately pulled item.
      .update(publish ? { is_published: true } : { is_published: false, scheduled_for: null })
      .eq("id", parsed.data.id);
    if (error) {
      return { status: "error", message: "Couldn’t update that item. Please try again." };
    }
  } catch {
    return { status: "error", message: "Couldn’t update that item. Please try again." };
  }

  revalidatePath("/admin/content");
  revalidatePath("/admin/brain");
  revalidatePath("/admin/calendar");
  revalidatePath("/content");
  return { status: "success" };
}

const BulkPublishSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(1000) });

/**
 * Publish many content items at once -- the Brain's "Publish all drafts in view"
 * control, so a freshly-imported batch (e.g. the journal) goes live in one click
 * instead of card-by-card. ntitt_admin only (friendly check; the content_items
 * UPDATE RLS policy is the real gate). Publish-only and scoped to the drafts it's
 * given, so it never clears a schedule or pulls anything already live.
 */
export async function bulkPublishContentItems(
  ids: string[]
): Promise<{ status: "success" | "error"; published: number; message?: string }> {
  await verifySession();
  const profile = await getProfile();
  if (profile.role !== "ntitt_admin") {
    return { status: "error", published: 0, message: "You don’t have access to the content studio." };
  }

  const parsed = BulkPublishSchema.safeParse({ ids });
  if (!parsed.success) {
    return { status: "error", published: 0, message: "Nothing to publish." };
  }

  try {
    const supabase = await createClient();
    // .eq("is_published", false) so already-live items are left untouched and the
    // returned rows are exactly the drafts that flipped -- an accurate count.
    const { data, error } = await supabase
      .from("content_items")
      .update({ is_published: true })
      .in("id", parsed.data.ids)
      .eq("is_published", false)
      .select("id");
    if (error) {
      return { status: "error", published: 0, message: "Couldn’t publish those. Please try again." };
    }

    revalidatePath("/admin/content");
    revalidatePath("/admin/brain");
    revalidatePath("/admin/calendar");
    revalidatePath("/content");
    return { status: "success", published: data?.length ?? 0 };
  } catch {
    return { status: "error", published: 0, message: "Couldn’t publish those. Please try again." };
  }
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
  revalidatePath("/admin/brain");
  revalidatePath("/admin/calendar");
  revalidatePath("/content");
  return { status: "success" };
}
