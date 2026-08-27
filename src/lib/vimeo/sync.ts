import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isVimeoConfigured, listVimeoVideos } from "@/lib/vimeo/client";
import { isVimeoPlayable, type VimeoVideoRef } from "@/lib/vimeo/parse";
import { buildVimeoInsertRow } from "@/lib/vimeo/importRow";
import { categorizeVideos } from "@/lib/ai/categorizeVideos";
import { resolveCategory, type CategoryAssignment } from "@/lib/vimeo/categoryPlan";
import { tagContentTopics } from "@/lib/content/topicTagging";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- accept either the session or service-role client
type AnyClient = SupabaseClient<any, any>;

const PER_PAGE = 100; // Vimeo's max page size — fewest round-trips per scan.
const MAX_PAGES = 30; // hard bound on outbound calls per run (≤3000 videos scanned).

export type VimeoSyncOutcome =
  | { status: "not_configured" }
  | { status: "error"; message: string }
  | { status: "success"; imported: number; failed: number; more: boolean };

/**
 * The shared engine behind BOTH the Brain's "Sync entire library" button and the
 * hourly auto-sync cron. Walks the connected Vimeo account newest-first, finds
 * videos not yet in content_items, and imports them — AI-categorised into a
 * member theme and published when `publish`. Two safety catches: it skips videos
 * Vimeo is still transcoding (would publish a blank player) and videos whose
 * Vimeo embed is fully OFF (privacy.embed = "private" — would show a broken
 * frame); those are picked up on a later run once Vimeo is ready / the embed is
 * opened up.
 *
 * Idempotent (dedup by vimeo_id, so a re-run only adds what's genuinely new) and
 * bounded (imports at most `limit` per run, reports `more: true` when new videos
 * remain so the caller or the next cron tick drains the rest).
 *
 * The caller supplies the Supabase client: the admin action passes its
 * ntitt_admin session client (RLS is the real insert gate); the cron passes the
 * service-role client. `createdBy` is the acting admin's id, or null for the cron.
 */
export async function syncVimeoLibrary(
  supabase: AnyClient,
  opts: { publish: boolean; limit: number; createdBy: string | null }
): Promise<VimeoSyncOutcome> {
  if (!isVimeoConfigured()) return { status: "not_configured" };

  const candidates: VimeoVideoRef[] = [];
  let more = false;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await listVimeoVideos({ page, perPage: PER_PAGE });
    if (!res.ok) return { status: "error", message: res.error };

    const pageVideos = res.data.videos;
    const existing = await existingVimeoIds(
      supabase,
      pageVideos.map((v) => v.id)
    );

    for (const v of pageVideos) {
      // Skip already-imported, still-transcoding, and un-embeddable videos.
      if (existing.has(v.id) || !isVimeoPlayable(v) || !v.embeddable) continue;
      candidates.push(v);
    }

    if (candidates.length >= opts.limit) {
      more = candidates.length > opts.limit || res.data.hasNext;
      break;
    }
    if (!res.data.hasNext) break; // scanned the whole account
    if (page === MAX_PAGES) more = true; // stopped at the page cap; more may remain
  }

  if (candidates.length === 0) return { status: "success", imported: 0, failed: 0, more: false };

  const batch = candidates.slice(0, opts.limit);
  if (candidates.length > opts.limit) more = true;

  // One batched AI call → category + tags per video; anything the model skipped
  // (or the whole batch, if AI errors/isn't configured) falls back to the default
  // category so every row carries a valid, NOT-NULL theme.
  let plan: Map<string, CategoryAssignment>;
  try {
    plan = await categorizeVideos(
      batch.map((v) => ({ id: v.id, name: v.name, description: v.description }))
    );
  } catch {
    plan = new Map();
  }

  const rows = batch.map((v) => {
    const { category, tags } = resolveCategory(v.id, plan);
    return buildVimeoInsertRow(
      {
        id: v.id,
        name: v.name,
        description: v.description,
        durationSeconds: v.durationSeconds,
        thumbnailUrl: v.thumbnailUrl,
        hash: v.hash,
      },
      { category, folderId: null, createdBy: opts.createdBy, isPublished: opts.publish, tags }
    );
  });

  const { data, error } = await supabase.from("content_items").insert(rows).select("id, vimeo_id");
  if (error) return { status: "error", message: "Couldn’t save the imported videos. Please try again." };

  const inserted = (data as { id: string; vimeo_id: string | null }[] | null) ?? [];

  // Auto-tag the just-imported items with member topics (the "new uploads flow
  // in tagged" half of the feature). Best-effort: a tagging failure or missing
  // AI key must never fail an import that already succeeded, so it's wrapped and
  // discarded. This one hook covers both callers of the shared engine (the Brain
  // button and the hourly cron).
  try {
    const toTag = inserted
      .map((r) => {
        const v = batch.find((b) => b.id === r.vimeo_id);
        return v ? { id: r.id, title: v.name, summary: v.description, tags: [] as string[] } : null;
      })
      .filter((x): x is { id: string; title: string; summary: string | null; tags: string[] } => x !== null);
    await tagContentTopics(supabase, toTag);
  } catch {
    /* topics are non-blocking */
  }

  const imported = inserted.length;
  return { status: "success", imported, failed: rows.length - imported, more };
}

/** Which of these vimeo_ids are already in content_items (as videos)? */
async function existingVimeoIds(supabase: AnyClient, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data } = await supabase
    .from("content_items")
    .select("vimeo_id")
    .eq("type", "video")
    .in("vimeo_id", ids);
  return new Set(
    ((data ?? []) as { vimeo_id: string | null }[]).map((r) => r.vimeo_id).filter((v): v is string => v != null)
  );
}
