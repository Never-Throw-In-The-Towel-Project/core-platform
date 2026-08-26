"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

/**
 * Bulk operations behind the Brain library console's multi-select action bar:
 * file, publish/unpublish, tag, set day, delete — applied to many content_items
 * at once so a freshly-imported batch (e.g. the Vimeo sync's Unfiled videos) can
 * be organised in one gesture instead of card-by-card.
 *
 * Every action is ntitt_admin-gated (friendly check; the content_items RLS is the
 * real gate), validates its id set with zod, mutates through the session client,
 * and revalidates the surfaces a change can touch. Behaviour mirrors the existing
 * single-item actions — notably: unpublishing also clears scheduled_for so the
 * publish-scheduled-content cron can't re-publish a deliberately pulled item.
 */

const IdsSchema = z.array(z.string().uuid()).min(1).max(1000);

const REVALIDATE = ["/admin/brain", "/admin/content", "/admin/calendar", "/content"] as const;
function revalidateBrain() {
  for (const path of REVALIDATE) revalidatePath(path);
}

export type BulkResult =
  | { status: "success"; count: number }
  | { status: "error"; message: string };

async function requireAdmin(): Promise<{ ok: true } | { ok: false; result: BulkResult }> {
  await verifySession();
  const profile = await getProfile();
  if (profile.role !== "ntitt_admin") {
    return { ok: false, result: { status: "error", message: "You don’t have access to the Brain." } };
  }
  return { ok: true };
}

/** Publish or unpublish many items. Unpublish clears any pending schedule. */
export async function bulkSetPublishedAction(input: { ids: string[]; published: boolean }): Promise<BulkResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.result;

  const parsed = IdsSchema.safeParse(input.ids);
  if (!parsed.success) return { status: "error", message: "Nothing selected." };

  try {
    const supabase = await createClient();
    const patch = input.published
      ? { is_published: true }
      : { is_published: false, scheduled_for: null };
    const { data, error } = await supabase
      .from("content_items")
      .update(patch)
      .in("id", parsed.data)
      .select("id");
    if (error) return { status: "error", message: "Couldn’t update those. Please try again." };
    revalidateBrain();
    return { status: "success", count: data?.length ?? 0 };
  } catch {
    return { status: "error", message: "Couldn’t update those. Please try again." };
  }
}

const MoveSchema = z.object({ ids: IdsSchema, folderId: z.string().uuid().nullable() });

/** File many items into a folder (folderId null = Unfiled). */
export async function bulkMoveToFolderAction(input: { ids: string[]; folderId: string | null }): Promise<BulkResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.result;

  const parsed = MoveSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Nothing to move." };

  try {
    const supabase = await createClient();
    // A non-null folder must exist (guards a stale/invalid id from the client).
    if (parsed.data.folderId) {
      const { data: folder } = await supabase
        .from("content_folders")
        .select("id")
        .eq("id", parsed.data.folderId)
        .maybeSingle();
      if (!folder) return { status: "error", message: "That folder no longer exists." };
    }
    const { data, error } = await supabase
      .from("content_items")
      .update({ folder_id: parsed.data.folderId })
      .in("id", parsed.data.ids)
      .select("id");
    if (error) return { status: "error", message: "Couldn’t file those. Please try again." };
    revalidateBrain();
    return { status: "success", count: data?.length ?? 0 };
  } catch {
    return { status: "error", message: "Couldn’t file those. Please try again." };
  }
}

const DaySchema = z.object({
  ids: IdsSchema,
  day: z.union([z.number().int().min(1).max(7), z.null()]),
});

/** Set (or clear, day = null) the day-of-week theme on many items. */
export async function bulkSetDayAction(input: { ids: string[]; day: number | null }): Promise<BulkResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.result;

  const parsed = DaySchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Nothing to update." };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("content_items")
      .update({ day_of_week: parsed.data.day })
      .in("id", parsed.data.ids)
      .select("id");
    if (error) return { status: "error", message: "Couldn’t set the day. Please try again." };
    revalidateBrain();
    return { status: "success", count: data?.length ?? 0 };
  } catch {
    return { status: "error", message: "Couldn’t set the day. Please try again." };
  }
}

const TagSchema = z.object({ ids: IdsSchema, tag: z.string().min(1).max(40) });

/** Add one tag to many items (merged, de-duped — never removes existing tags). */
export async function bulkAddTagAction(input: { ids: string[]; tag: string }): Promise<BulkResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.result;

  const parsed = TagSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Enter a tag first." };
  const tag = parsed.data.tag.trim().toLowerCase().replace(/^#/, "");
  if (tag === "") return { status: "error", message: "Enter a tag first." };

  try {
    const supabase = await createClient();
    const { data: rows, error: readError } = await supabase
      .from("content_items")
      .select("id, tags")
      .in("id", parsed.data.ids);
    if (readError) return { status: "error", message: "Couldn’t tag those. Please try again." };

    // Only touch rows that don't already carry the tag; merge + de-dupe per row.
    const toUpdate = ((rows ?? []) as { id: string; tags: string[] | null }[]).filter(
      (r) => !(r.tags ?? []).includes(tag)
    );
    const results = await Promise.all(
      toUpdate.map((r) =>
        supabase
          .from("content_items")
          .update({ tags: Array.from(new Set([...(r.tags ?? []), tag])) })
          .eq("id", r.id)
      )
    );
    if (results.some((res) => res.error)) {
      return { status: "error", message: "Some items couldn’t be tagged. Please try again." };
    }
    revalidateBrain();
    return { status: "success", count: toUpdate.length };
  } catch {
    return { status: "error", message: "Couldn’t tag those. Please try again." };
  }
}

/** Delete many items. Channel placements cascade; challenge days FK-null out. */
export async function bulkDeleteAction(input: { ids: string[] }): Promise<BulkResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.result;

  const parsed = IdsSchema.safeParse(input.ids);
  if (!parsed.success) return { status: "error", message: "Nothing selected." };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("content_items")
      .delete()
      .in("id", parsed.data)
      .select("id");
    if (error) return { status: "error", message: "Couldn’t delete those. Please try again." };
    revalidateBrain();
    return { status: "success", count: data?.length ?? 0 };
  } catch {
    return { status: "error", message: "Couldn’t delete those. Please try again." };
  }
}
