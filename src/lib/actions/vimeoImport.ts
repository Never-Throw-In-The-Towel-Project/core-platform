"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { fetchVimeoVideo, isVimeoConfigured, listVimeoVideos } from "@/lib/vimeo/client";
import { vimeoEmbedWarning, type VimeoVideoRef } from "@/lib/vimeo/parse";
import { buildVimeoInsertRow } from "@/lib/vimeo/importRow";
import { syncVimeoLibrary, type VimeoSyncOutcome } from "@/lib/vimeo/sync";

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

/** How many videos to enrich per backfill run — bounds the outbound Vimeo calls. */
const BACKFILL_LIMIT = 40;

export type VimeoBackfillResult =
  | { status: "not_configured" }
  | { status: "error"; message: string }
  | { status: "success"; updated: number; failed: number; remaining: number; nextCursor: string | null };

/**
 * Two jobs sharing one fetch-and-store loop:
 *
 * - "missing" (default): fill thumbnail/hash/duration for videos added by hand
 *   (paste-an-ID) before Vimeo was connected — the original one-click sync.
 *   Selects only rows still missing a still or duration.
 *
 * - "refresh": re-derive the still for EVERY video, so an existing catalogue
 *   picks up a changed thumbnail policy (e.g. the 1280px→640px right-sizing).
 *   Walks all video rows by id (`cursor` = the last id processed), a page at a
 *   time, so repeated calls make deterministic progress regardless of catalogue
 *   size — the caller loops until `nextCursor` is null.
 *
 * Either way it only ever writes the Vimeo-derived fields; an edited
 * title/summary is never touched. Bounded to BACKFILL_LIMIT outbound calls per
 * run.
 */
export async function backfillVimeoMetadataAction(
  opts: { mode?: "missing" | "refresh"; cursor?: string } = {}
): Promise<VimeoBackfillResult> {
  const mode = opts.mode ?? "missing";
  await verifySession();
  const profile = await getProfile();
  if (profile.role !== "ntitt_admin") return { status: "error", message: "You don’t have access to the Brain." };
  if (!isVimeoConfigured()) return { status: "not_configured" };

  const supabase = await createClient();
  let query = supabase.from("content_items").select("id, vimeo_id").eq("type", "video");
  if (mode === "refresh") {
    // Every video, walked by id so a cursor gives a stable, complete sweep.
    query = query.not("vimeo_id", "is", null).order("id", { ascending: true });
    if (opts.cursor) query = query.gt("id", opts.cursor);
  } else {
    // "Not yet enriched" = a video with no still or no duration. (A public video
    // legitimately has no hash, so hash-null is NOT the signal.)
    query = query.or("thumbnail_url.is.null,duration_seconds.is.null");
  }
  const { data, error } = await query.limit(BACKFILL_LIMIT + 1);
  if (error) return { status: "error", message: "Couldn’t list videos to sync. Please try again." };

  const rows = (data ?? []) as { id: string; vimeo_id: string | null }[];
  const hasMore = rows.length > BACKFILL_LIMIT;
  const batch = rows.slice(0, BACKFILL_LIMIT);
  // "missing" reports a rough count still to go; "refresh" hands back a cursor so
  // the caller can page the whole catalogue without re-scanning from the top.
  const remaining = mode === "refresh" ? 0 : hasMore ? rows.length - BACKFILL_LIMIT : 0;
  const nextCursor = mode === "refresh" && hasMore && batch.length > 0 ? batch[batch.length - 1].id : null;

  let updated = 0;
  let failed = 0;
  for (const row of batch) {
    if (!row.vimeo_id) {
      failed++;
      continue;
    }
    const res = await fetchVimeoVideo(row.vimeo_id);
    if (!res.ok) {
      failed++;
      continue;
    }
    const { error: updateError } = await supabase
      .from("content_items")
      .update({
        thumbnail_url: res.data.thumbnailUrl ?? null,
        vimeo_hash: res.data.hash ?? null,
        duration_seconds: res.data.durationSeconds ?? null,
      })
      .eq("id", row.id);
    if (updateError) failed++;
    else updated++;
  }

  if (updated > 0) {
    revalidatePath("/admin/brain");
    revalidatePath("/admin/content");
    revalidatePath("/content");
  }
  return { status: "success", updated, failed, remaining, nextCursor };
}

/** How many videos one "Sync entire library" click imports — bounds the AI +
 *  insert work so the action returns well inside the request budget; the button
 *  reports `more` and the operator clicks again to drain a big backlog. */
const BULK_SYNC_LIMIT = 40;

/**
 * One-click "Sync entire Vimeo library" for the Brain: pulls every video not yet
 * imported, AI-categorises it and publishes it LIVE (the operator chose fully-
 * automatic ingestion). Shares the exact engine the hourly cron uses, so the
 * manual button and the automation can never drift apart. ntitt_admin-gated;
 * the content_items INSERT RLS is the real gate.
 */
export async function syncVimeoLibraryAction(): Promise<VimeoSyncOutcome> {
  const session = await verifySession();
  const profile = await getProfile();
  if (profile.role !== "ntitt_admin") return { status: "error", message: "You don’t have access to the Brain." };

  const supabase = await createClient();
  const result = await syncVimeoLibrary(supabase, {
    publish: true,
    limit: BULK_SYNC_LIMIT,
    createdBy: session.userId,
  });

  if (result.status === "success" && result.imported > 0) {
    revalidatePath("/admin/brain");
    revalidatePath("/admin/content");
    revalidatePath("/admin/calendar");
    revalidatePath("/content");
  }
  return result;
}
