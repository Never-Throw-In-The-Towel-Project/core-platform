"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { type RoutineActionState } from "./routineState";

/**
 * Brain knowledge-base folder management (see
 * supabase/migrations/20260815000000_brain_content_folders.sql). Folders are the
 * Super Admin Brain's organising unit over the content_items spine; members
 * never see them. ntitt_admin only: the role is checked here for a friendly
 * message, but the real boundary is the content_folders RLS (ntitt_admin-gated
 * for every operation, verified live by the migration harness) — the same
 * defense-in-depth pattern as lib/actions/content.ts.
 *
 * Folder assignment on an item is handled two ways, deliberately kept out of
 * updateContentItem so editing an item's content never silently un-files it:
 *   • new items are filed on create (createContentItem reads an optional
 *     `folderId` from the quick-add form), and
 *   • existing items are re-filed with moveItemToFolder below.
 */

const FolderCreateSchema = z.object({
  name: z.string().trim().min(1, "Give the folder a name.").max(80),
  description: z.string().trim().max(500).optional(),
});

const FolderUpdateSchema = FolderCreateSchema.extend({ id: z.string().uuid() });
const FolderIdSchema = z.object({ id: z.string().uuid() });

async function requireAdmin(): Promise<{ userId: string } | { error: RoutineActionState }> {
  const session = await verifySession();
  const profile = await getProfile();
  if (profile.role !== "ntitt_admin") {
    return { error: { status: "error", message: "You don’t have access to the Brain." } };
  }
  return { userId: session.userId };
}

/**
 * Whether a folder named `name` already exists (case-insensitive), optionally
 * excluding one id (for rename). Folder counts are small, so a full read + JS
 * compare is simplest and sidesteps LIKE-wildcard escaping on the name.
 */
async function folderNameExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string,
  excludeId?: string
): Promise<boolean> {
  const target = name.trim().toLowerCase();
  const { data } = await supabase.from("content_folders").select("id, name");
  return ((data as { id: string; name: string }[] | null) ?? []).some(
    (f) => f.id !== excludeId && f.name.toLowerCase() === target
  );
}

export async function createFolder(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = FolderCreateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the folder name." };
  }

  try {
    const supabase = await createClient();
    // Reject a duplicate name (case-insensitive), matching how the auto-organise
    // apply path dedupes folder names — otherwise the two create paths disagree
    // and "Sleep"/"sleep" split items between indistinguishable folders.
    if (await folderNameExists(supabase, parsed.data.name)) {
      return { status: "error", message: `A folder called “${parsed.data.name}” already exists.` };
    }
    const { error } = await supabase.from("content_folders").insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      created_by: auth.userId,
    });
    if (error) {
      return { status: "error", message: "Couldn’t create that folder. Please try again." };
    }
  } catch {
    return { status: "error", message: "Couldn’t create that folder. Please try again." };
  }

  revalidatePath("/admin/brain");
  return { status: "success" };
}

export async function renameFolder(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = FolderUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the folder name." };
  }

  try {
    const supabase = await createClient();
    if (await folderNameExists(supabase, parsed.data.name, parsed.data.id)) {
      return { status: "error", message: `A folder called “${parsed.data.name}” already exists.` };
    }
    const { error } = await supabase
      .from("content_folders")
      .update({ name: parsed.data.name, description: parsed.data.description ?? null })
      .eq("id", parsed.data.id);
    if (error) {
      return { status: "error", message: "Couldn’t rename that folder. Please try again." };
    }
  } catch {
    return { status: "error", message: "Couldn’t rename that folder. Please try again." };
  }

  revalidatePath("/admin/brain");
  return { status: "success" };
}

/**
 * Delete a folder. Its items are NOT deleted — content_items.folder_id is
 * `on delete set null`, so they fall back to "Unfiled" (see the migration
 * header). Content lifecycle stays owned by content_items / deleteContentItem.
 */
export async function deleteFolder(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = FolderIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { status: "error", message: "Couldn’t find that folder." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("content_folders").delete().eq("id", parsed.data.id);
    if (error) {
      return { status: "error", message: "Couldn’t delete that folder. Please try again." };
    }
  } catch {
    return { status: "error", message: "Couldn’t delete that folder. Please try again." };
  }

  revalidatePath("/admin/brain");
  return { status: "success" };
}

const MoveSchema = z.object({
  itemId: z.string().uuid(),
  // Empty string = "Unfiled" (null). A uuid = file into that folder.
  folderId: z.union([z.string().uuid(), z.literal("")]),
});

/**
 * Re-file a single content item into a folder (or Unfiled when folderId is
 * empty). The only path that changes an existing item's folder — updateContentItem
 * deliberately leaves folder_id alone.
 */
export async function moveItemToFolder(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = MoveSchema.safeParse({
    itemId: formData.get("itemId"),
    folderId: formData.get("folderId") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: "Couldn’t move that item." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("content_items")
      .update({ folder_id: parsed.data.folderId === "" ? null : parsed.data.folderId })
      .eq("id", parsed.data.itemId);
    if (error) {
      return { status: "error", message: "Couldn’t move that item. Please try again." };
    }
  } catch {
    return { status: "error", message: "Couldn’t move that item. Please try again." };
  }

  revalidatePath("/admin/brain");
  revalidatePath("/admin/content");
  return { status: "success" };
}
