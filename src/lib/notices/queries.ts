import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Notice } from "@/types/database";
import { noticeImageUrl } from "@/lib/notices/imageUpload";
import { noticeVideoUrl } from "@/lib/notices/videoUpload";

// createClient() is typed with a schema union; notices live in `public`, but
// callers pass whichever client instance they already have -- same pattern as
// lib/content/queries.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any>;

/** A notice decorated with its resolved media URLs (each null unless the
 *  matching media_kind), so a rendering surface never needs the storage client
 *  itself. */
export interface NoticeView extends Notice {
  image_url: string | null;
  video_url: string | null;
}

function decorate(supabase: AnyClient, rows: Notice[] | null): NoticeView[] {
  return (rows ?? []).map((n) => ({
    ...n,
    image_url: n.media_kind === "image" ? noticeImageUrl(supabase, n.image_path) : null,
    video_url: n.media_kind === "video" ? noticeVideoUrl(supabase, n.video_path) : null,
  }));
}

/**
 * The notices to show on the Today page for a given day. Published only
 * (enforced by RLS AND re-stated here); within the inclusive date window (either
 * bound null = unbounded); and either day-agnostic (weekday null) or matching
 * today's ISO weekday. Highest priority first, newest as the tie-break -- the
 * widget shows the top card.
 *
 * `todayIso` is the member's local calendar day (yyyy-mm-dd) and `isoWeekday` is
 * that day's ISO weekday (1 = Mon … 7 = Sun); both are computed by the caller
 * from the member's timezone, exactly like the day-of-week content carousel.
 */
export async function listActiveNotices(
  supabase: AnyClient,
  opts: { isoWeekday: number; todayIso: string }
): Promise<NoticeView[]> {
  const { data } = await supabase
    .from("notices")
    .select("*")
    .eq("is_published", true)
    .or(`starts_on.is.null,starts_on.lte.${opts.todayIso}`)
    .or(`ends_on.is.null,ends_on.gte.${opts.todayIso}`)
    .or(`weekday.is.null,weekday.eq.${opts.isoWeekday}`)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  return decorate(supabase, data as Notice[] | null);
}

/**
 * Every notice for the Super Admin Studio, including unpublished drafts. Only an
 * ntitt_admin session sees drafts (the "ntitt admins read all notices" RLS
 * policy); a non-admin caller would get published rows only, so this is safe to
 * call after the role check. Highest priority first, newest as the tie-break.
 */
export async function listAllNoticesForAdmin(supabase: AnyClient): Promise<NoticeView[]> {
  const { data } = await supabase
    .from("notices")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  return decorate(supabase, data as Notice[] | null);
}

/** A single notice for the Studio edit page. RLS applies as for the list. */
export async function getNoticeForAdmin(supabase: AnyClient, id: string): Promise<NoticeView | null> {
  const { data } = await supabase.from("notices").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return decorate(supabase, [data as Notice])[0] ?? null;
}
