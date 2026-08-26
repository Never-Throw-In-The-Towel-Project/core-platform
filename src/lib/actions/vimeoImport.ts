"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isVimeoConfigured, listVimeoVideos } from "@/lib/vimeo/client";
import { vimeoEmbedWarning, type VimeoVideoRef } from "@/lib/vimeo/parse";
import { buildVimeoInsertRow } from "@/lib/vimeo/importRow";

/**
 * Server actions behind the Brain's "Import from Vimeo" picker. Both are
 * ntitt_admin-gated (the content_items INSERT RLS is the real gate). Reads the
 * Vimeo account via the server-only client and writes drafts through the same
 * content_items table as every other content path.
 */

const PER_PAGE = 24;

export interface VimeoListItem extends VimeoVideoRef {
  /** Already present in content_items as a video with this vimeo_id. */
  alreadyImported: boolean;
  /** A privacy warning to show (embedding blocked / allowlist / password), or null. */
  warning: string | null;
}

export type VimeoListResult =
  | { status: "not_configured" }
  | { status: "error"; message: string }
  | { status: "ok"; videos: VimeoListItem[]; page: number; hasNext: boolean };

/** One page of the connected Vimeo account, flagged with import + privacy state. */
export async function listVimeoLibraryAction(input: { page?: number; query?: string } = {}): Promise<VimeoListResult> {
  await verifySession();
  const profile = await getProfile();
  if (profile.role !== "ntitt_admin") return { status: "error", message: "You don’t have access to the Brain." };

  if (!isVimeoConfigured()) return { status: "not_configured" };

  const res = await listVimeoVideos({ page: Math.max(1, input.page ?? 1), perPage: PER_PAGE, query: input.query });
  if (!res.ok) return { status: "error", message: `Couldn’t reach Vimeo: ${res.error}` };

  // Mark videos already in the Brain so they can't be double-imported.
  const ids = res.data.videos.map((v) => v.id);
  let imported = new Set<string>();
  if (ids.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase.from("content_items").select("vimeo_id").eq("type", "video").in("vimeo_id", ids);
    imported = new Set(
      ((data ?? []) as { vimeo_id: string | null }[]).map((r) => r.vimeo_id).filter((v): v is string => v != null)
    );
  }

  const videos: VimeoListItem[] = res.data.videos.map((v) => ({
    ...v,
    alreadyImported: imported.has(v.id),
    warning: vimeoEmbedWarning(v),
  }));

  return { status: "ok", videos, page: res.data.page, hasNext: res.data.hasNext };
}

const ImportSchema = z.object({
  videos: z
    .array(
      z.object({
        id: z.string().regex(/^\d+$/),
        name: z.string(),
        description: z.string().nullable(),
        durationSeconds: z.number().nullable(),
        thumbnailUrl: z.string().nullable(),
        hash: z.string().nullable(),
      })
    )
    .min(1)
    .max(50),
  category: z.enum(["mental_fitness", "physical_fitness", "nutrition", "tools_tips"]),
  folderId: z.string().uuid().nullable().optional(),
});

export type VimeoImportResult =
  | { status: "success"; imported: number; skipped: number }
  | { status: "error"; message: string };

/** Import the chosen Vimeo videos as DRAFT content_items (dedup by vimeo_id). */
export async function importVimeoVideosAction(input: unknown): Promise<VimeoImportResult> {
  const session = await verifySession();
  const profile = await getProfile();
  if (profile.role !== "ntitt_admin") return { status: "error", message: "You don’t have access to the Brain." };

  const parsed = ImportSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Nothing valid to import — pick at least one video." };
  const { videos, category, folderId } = parsed.data;

  try {
    const supabase = await createClient();

    // Dedup against anything already imported (a concurrent import, or a re-tick).
    const ids = videos.map((v) => v.id);
    const { data: existing } = await supabase
      .from("content_items")
      .select("vimeo_id")
      .eq("type", "video")
      .in("vimeo_id", ids);
    const already = new Set(
      ((existing ?? []) as { vimeo_id: string | null }[]).map((r) => r.vimeo_id).filter((v): v is string => v != null)
    );
    const fresh = videos.filter((v) => !already.has(v.id));
    if (fresh.length === 0) return { status: "success", imported: 0, skipped: videos.length };

    const rows = fresh.map((v) =>
      buildVimeoInsertRow(v, { category, folderId: folderId ?? null, createdBy: session.userId })
    );
    const { data: inserted, error } = await supabase.from("content_items").insert(rows).select("id");
    if (error) return { status: "error", message: "Something went wrong importing those. Please try again." };

    revalidatePath("/admin/brain");
    revalidatePath("/admin/content");
    revalidatePath("/admin/calendar");
    revalidatePath("/content");
    return { status: "success", imported: inserted?.length ?? fresh.length, skipped: videos.length - fresh.length };
  } catch {
    return { status: "error", message: "Something went wrong importing those. Please try again." };
  }
}
