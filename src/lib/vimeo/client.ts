import "server-only";
import { friendlyVimeoError, mapVimeoVideo, type VimeoVideoRef } from "@/lib/vimeo/parse";

/**
 * The ONE place the app talks to the Vimeo API (v3.4 REST, keyed by
 * vimeo_access_token; no SDK) — mirrors lib/email/brevo.ts: server-only, native
 * fetch, and a graceful "not configured" result (never a throw) when the token
 * is absent, so the existing paste-an-ID embed path keeps working until Vimeo is
 * connected. Only ever reads (list + single video metadata); it never writes to
 * Vimeo. Response → our shape mapping is the pure, tested code in ./parse.ts.
 */

const VIMEO_API = "https://api.vimeo.com";
const VIMEO_ACCEPT = "application/vnd.vimeo.*+json;version=3.4";
// Only the fields we use — keeps responses small and stable.
const VIDEO_FIELDS = "uri,name,description,duration,link,player_embed_url,privacy,pictures,status";

export type VimeoResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

// NB: the env var is lowercase `vimeo_access_token` to match how it is set in
// the deployment (Vercel). Env var names are case-sensitive on Node/Linux, so
// do NOT "normalise" this to upper-case — that silently disconnects Vimeo.
export function isVimeoConfigured(): boolean {
  return typeof process.env.vimeo_access_token === "string" && process.env.vimeo_access_token.trim().length > 0;
}

async function vimeoGet<T>(path: string, params: Record<string, string | number> = {}): Promise<VimeoResult<T>> {
  const token = process.env.vimeo_access_token;
  if (!token) return { ok: false, error: "not configured" };

  const url = new URL(`${VIMEO_API}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: VIMEO_ACCEPT },
      // Admin data pulled live per request; never cache a token-scoped response.
      cache: "no-store",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      // Vimeo error bodies carry a human message in `error`; map auth/scope
      // failures (401/403 or Vimeo's opaque "get in touch with the app's
      // creator") to an operator-actionable message instead of relaying it raw.
      const raw = (data?.error as string) ?? `HTTP ${res.status}`;
      return { ok: false, error: friendlyVimeoError(res.status, raw), status: res.status };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** Fetch one video's metadata by numeric id — used to verify + enrich on paste. */
export async function fetchVimeoVideo(id: string): Promise<VimeoResult<VimeoVideoRef>> {
  const res = await vimeoGet<unknown>(`/videos/${id}`, { fields: VIDEO_FIELDS });
  if (!res.ok) return res;
  const video = mapVimeoVideo(res.data);
  if (!video) return { ok: false, error: "Unrecognized Vimeo response." };
  return { ok: true, data: video };
}

export interface VimeoPage {
  videos: VimeoVideoRef[];
  page: number;
  perPage: number;
  total: number;
  hasNext: boolean;
}

/** A page of the account's videos (newest first), for the import picker. */
export async function listVimeoVideos(opts: { page?: number; perPage?: number; query?: string } = {}): Promise<VimeoResult<VimeoPage>> {
  const params: Record<string, string | number> = {
    fields: `${VIDEO_FIELDS},paging`,
    page: opts.page ?? 1,
    per_page: Math.min(Math.max(opts.perPage ?? 24, 1), 100),
    sort: "date",
    direction: "desc",
  };
  if (opts.query && opts.query.trim() !== "") params.query = opts.query.trim();

  const res = await vimeoGet<{
    data?: unknown[];
    page?: number;
    per_page?: number;
    total?: number;
    paging?: { next?: string | null };
  }>(`/me/videos`, params);
  if (!res.ok) return res;

  const raw = res.data;
  const videos = (raw.data ?? []).map(mapVimeoVideo).filter((v): v is VimeoVideoRef => v !== null);
  return {
    ok: true,
    data: {
      videos,
      page: raw.page ?? opts.page ?? 1,
      perPage: raw.per_page ?? params.per_page as number,
      total: raw.total ?? videos.length,
      hasNext: Boolean(raw.paging?.next),
    },
  };
}
