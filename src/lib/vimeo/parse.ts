/**
 * Pure parsing for the Vimeo API — no I/O, no `server-only`, so the mapping from
 * Vimeo's video JSON to our shape is unit-testable in isolation. The server-only
 * fetch client (./client.ts) calls these on the responses it gets.
 *
 * Vimeo API v3.4 video object (the fields we request): `uri` ("/videos/123"),
 * `name`, `description`, `duration` (seconds), `link`, `player_embed_url`,
 * `privacy` ({ view, embed }), `pictures` ({ base_link, sizes: [{ width, link }] }).
 */

export interface VimeoVideoRef {
  /** Numeric video id (from the API `uri`). */
  id: string;
  name: string;
  description: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  /** Unlisted/private play hash for the `?h=` embed param; null when public. */
  hash: string | null;
  /** Vimeo `privacy.view`: anybody | nobody | unlisted | disable | contacts | password. */
  privacyView: string | null;
  /** Vimeo `privacy.embed`: public | private | whitelist. */
  privacyEmbed: string | null;
  /** False when Vimeo will refuse to embed this anywhere (privacy.embed = private). */
  embeddable: boolean;
  link: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- raw Vimeo JSON is untyped */

/** "/videos/123456789" (optionally with a trailing hash segment) → "123456789". */
export function vimeoIdFromUri(uri: unknown): string | null {
  if (typeof uri !== "string") return null;
  const m = uri.match(/\/videos\/(\d+)/);
  return m ? m[1] : null;
}

/** Accepts a full Vimeo URL or a bare id and returns the numeric id, or null. */
export function vimeoIdFromInput(input: string): string | null {
  const s = input.trim();
  if (/^\d+$/.test(s)) return s;
  const m = s.match(/vimeo\.com\/(?:video\/)?(\d+)/i) ?? s.match(/\/videos\/(\d+)/);
  return m ? m[1] : null;
}

/**
 * The unlisted play hash. Vimeo exposes it two ways for an unlisted video: as
 * the `h` query param on `player_embed_url`, and as the second path segment of
 * `link` (vimeo.com/{id}/{hash}). Prefer the explicit param.
 */
export function vimeoHashFrom(video: any): string | null {
  const embed: unknown = video?.player_embed_url;
  if (typeof embed === "string") {
    const m = embed.match(/[?&]h=([A-Za-z0-9]+)/);
    if (m) return m[1];
  }
  const link: unknown = video?.link;
  if (typeof link === "string") {
    const m = link.match(/vimeo\.com\/\d+\/([A-Za-z0-9]+)/);
    if (m) return m[1];
  }
  return null;
}

/** Largest available still from `pictures.sizes`, falling back to `base_link`. */
export function vimeoThumbnail(pictures: any): string | null {
  const sizes = pictures?.sizes;
  if (Array.isArray(sizes) && sizes.length > 0) {
    const best = sizes.reduce(
      (a: any, b: any) => ((b?.width ?? 0) > (a?.width ?? 0) ? b : a),
      sizes[0]
    );
    if (typeof best?.link === "string") return best.link;
  }
  return typeof pictures?.base_link === "string" ? pictures.base_link : null;
}

/** Map one raw Vimeo video object to our VimeoVideoRef, or null if it has no id. */
export function mapVimeoVideo(raw: any): VimeoVideoRef | null {
  const id = vimeoIdFromUri(raw?.uri);
  if (!id) return null;

  const privacyView = typeof raw?.privacy?.view === "string" ? raw.privacy.view : null;
  const privacyEmbed = typeof raw?.privacy?.embed === "string" ? raw.privacy.embed : null;

  const description = typeof raw?.description === "string" && raw.description.trim() !== "" ? raw.description : null;

  return {
    id,
    name: typeof raw?.name === "string" ? raw.name : "",
    description,
    durationSeconds: typeof raw?.duration === "number" && Number.isFinite(raw.duration) ? raw.duration : null,
    thumbnailUrl: vimeoThumbnail(raw?.pictures),
    hash: vimeoHashFrom(raw),
    privacyView,
    privacyEmbed,
    // Only `privacy.embed = "private"` blocks embedding outright; "whitelist"
    // embeds where the domain is allowlisted, "public" anywhere.
    embeddable: privacyEmbed !== "private",
    link: typeof raw?.link === "string" ? raw.link : null,
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/** The member-facing player URL, hash-aware so unlisted videos actually play. */
export function buildVimeoEmbedUrl(vimeoId: string, hash?: string | null): string {
  return `https://player.vimeo.com/video/${vimeoId}${hash ? `?h=${hash}` : ""}`;
}

/**
 * A short, human-readable warning when a video's Vimeo privacy will stop it
 * playing on the platform — surfaced in the import picker so an operator knows
 * to fix it in Vimeo. null = fine to embed.
 */
export function vimeoEmbedWarning(video: Pick<VimeoVideoRef, "privacyView" | "privacyEmbed">): string | null {
  if (video.privacyEmbed === "private") {
    return "Embedding is turned off for this video in Vimeo — set “Where can this be embedded?” to allow your site.";
  }
  if (video.privacyEmbed === "whitelist") {
    return "Embeds only on allowlisted domains — add your platform domain in Vimeo’s embed settings.";
  }
  if (video.privacyView === "password") {
    return "Password-protected videos can’t play inline on the platform.";
  }
  return null;
}
