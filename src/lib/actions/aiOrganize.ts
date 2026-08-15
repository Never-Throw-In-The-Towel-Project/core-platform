"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isAiConfigured } from "@/lib/ai/client";
import { proposeContentOrganization } from "@/lib/ai/organizeContent";
import { listContentFolders } from "@/lib/content/brain";
import { type RoutineActionState } from "./routineState";

/**
 * The Brain's "auto-organise" pass (docs/CONTENT_PLATFORM_STRATEGY.md — the AI
 * brain sorts and arranges). Two halves, both ntitt_admin-gated, both
 * assistive-with-confirm:
 *   • proposeOrganizationAction — reads a batch of items + the existing folders
 *     and asks the model for a folder + tags per item. Writes NOTHING; returns a
 *     plan for the admin to review.
 *   • applyOrganizationAction — takes the (possibly edited/whittled) plan the
 *     admin approved, creates any genuinely-new folders once, and files + retags
 *     the selected items. This is the only half that writes.
 *
 * The model never writes directly — the same boundary as suggestTagsAction.
 */

// One AI call stays cheap and within max_tokens; a larger view organises in
// batches. The action reports how many were left for a follow-up pass.
const MAX_BATCH = 40;

type OrganizationProposalView = {
  itemId: string;
  title: string;
  currentFolderId: string | null;
  folder: string;
  isNewFolder: boolean;
  tags: string[];
};

export type OrganizationPlan = {
  proposals: OrganizationProposalView[];
  /** How many items were beyond this batch (organise again to cover them). */
  truncated: number;
};

export type ProposeOrganizationResult =
  | { status: "ok"; plan: OrganizationPlan }
  | { status: "error"; message: string };

export async function proposeOrganizationAction(input: {
  itemIds: string[];
  /** Folder names proposed in earlier chunks of a whole-library run, so this
   *  chunk reuses them instead of inventing near-duplicate variants. */
  knownNewFolders?: string[];
}): Promise<ProposeOrganizationResult> {
  await requireNtittAdmin();

  if (!isAiConfigured()) {
    return { status: "error", message: "AI organising isn’t configured in this environment yet." };
  }

  const parsed = z.array(z.string().uuid()).min(1).max(1000).safeParse(input.itemIds);
  if (!parsed.success) {
    return { status: "error", message: "There’s nothing here to organise." };
  }

  const knownNew = z.array(z.string().trim().min(1).max(80)).max(200).safeParse(input.knownNewFolders ?? []);
  const knownNewFolders = knownNew.success ? knownNew.data : [];

  const batch = parsed.data.slice(0, MAX_BATCH);
  const truncated = parsed.data.length - batch.length;

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("content_items")
      .select("id, title, summary, type, tags, folder_id")
      .in("id", batch);

    const items =
      (data as
        | { id: string; title: string; summary: string | null; type: string; tags: string[]; folder_id: string | null }[]
        | null) ?? [];
    if (items.length === 0) {
      return { status: "error", message: "Couldn’t load those items to organise. Please try again." };
    }

    const folders = await listContentFolders(supabase);
    const folderByLower = new Map(folders.map((f) => [f.name.toLowerCase(), f.name]));

    const proposals = await proposeContentOrganization(
      items.map((i) => ({ id: i.id, title: i.title, summary: i.summary, type: i.type, tags: i.tags })),
      // The model sees DB folders PLUS names proposed in earlier chunks, so a
      // whole-library run converges on one folder set instead of many variants.
      // folderByLower (DB folders only) still decides isNewFolder below, so an
      // earlier-chunk name correctly stays flagged "New" until it's created.
      [...folders.map((f) => f.name), ...knownNewFolders]
    );

    const byId = new Map(items.map((i) => [i.id, i]));
    const view: OrganizationProposalView[] = proposals
      .filter((p) => byId.has(p.id))
      .map((p) => {
        const item = byId.get(p.id)!;
        // Match a proposed name to an existing folder case-insensitively so the
        // model saying "sleep" for an existing "Sleep" reuses it, not duplicates.
        const existingName = folderByLower.get(p.folder.toLowerCase());
        return {
          itemId: p.id,
          title: item.title,
          currentFolderId: item.folder_id,
          folder: existingName ?? p.folder,
          isNewFolder: existingName === undefined,
          tags: p.tags,
        };
      });

    if (view.length === 0) {
      return { status: "error", message: "The AI didn’t return any usable suggestions. Please try again." };
    }

    return { status: "ok", plan: { proposals: view, truncated } };
  } catch {
    return { status: "error", message: "Couldn’t reach the AI just now — try again in a moment." };
  }
}

const AssignmentSchema = z.object({
  itemId: z.string().uuid(),
  folder: z.string().trim().min(1).max(80),
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
});

export async function applyOrganizationAction(input: {
  assignments: { itemId: string; folder: string; tags: string[] }[];
}): Promise<RoutineActionState> {
  const profile = await requireNtittAdmin();

  const parsed = z.array(AssignmentSchema).min(1).max(MAX_BATCH).safeParse(input.assignments);
  if (!parsed.success) {
    return { status: "error", message: "Nothing selected to apply." };
  }

  try {
    const supabase = await createClient();

    // Resolve folder names to ids, creating any that don't exist yet — once each,
    // deduped case-insensitively so two items headed for the same new folder
    // don't create two.
    const folders = await listContentFolders(supabase);
    const nameToId = new Map(folders.map((f) => [f.name.toLowerCase(), f.id]));

    const neededNames = new Map<string, string>(); // lower -> display name
    for (const a of parsed.data) {
      const key = a.folder.toLowerCase();
      if (!nameToId.has(key) && !neededNames.has(key)) neededNames.set(key, a.folder);
    }
    for (const [key, name] of neededNames) {
      const { data, error } = await supabase
        .from("content_folders")
        .insert({ name, created_by: profile.id })
        .select("id")
        .single();
      if (error || !data) {
        return { status: "error", message: "Couldn’t create a folder while organising. Please try again." };
      }
      nameToId.set(key, data.id);
    }

    for (const a of parsed.data) {
      const folderId = nameToId.get(a.folder.toLowerCase());
      if (!folderId) {
        return { status: "error", message: "Couldn’t match a folder while organising. Please try again." };
      }
      const tags = Array.from(
        new Set(a.tags.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0))
      ).slice(0, 12);
      const { error } = await supabase
        .from("content_items")
        .update({ folder_id: folderId, tags })
        .eq("id", a.itemId);
      if (error) {
        return { status: "error", message: "Applied some changes, but not all — please review and try again." };
      }
    }
  } catch {
    return { status: "error", message: "Couldn’t apply the changes just now. Please try again." };
  }

  revalidatePath("/admin/brain");
  revalidatePath("/admin/content");
  revalidatePath("/content");
  return { status: "success" };
}
