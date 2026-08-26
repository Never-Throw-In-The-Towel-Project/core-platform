-- ============================================================================
-- content_items: capture Vimeo video metadata so videos become first-class.
-- ============================================================================
-- Today a video is only a hand-typed numeric vimeo_id dropped into a bare
-- player iframe: no thumbnail is ever stored, duration_seconds is never
-- populated, and a private Vimeo video won't embed without its play hash. These
-- two nullable columns let the Vimeo API integration backfill what it fetches:
--
--   * thumbnail_url — the Vimeo still (pictures.base_link), so the Library rows,
--     the day carousel and the Brain grid show a real poster instead of the grey
--     ▶ placeholder. Stored as the Vimeo CDN URL (re-synced if it ever rotates),
--     not downloaded into a bucket — it's a public poster, not private media.
--
--   * vimeo_hash — the unlisted/private "play hash" (the ?h= token). The watch
--     page embeds player.vimeo.com/video/{id}?h={hash} when present, which is how
--     an unlisted video is allowed to play off-Vimeo. Null for public videos.
--
-- Both are nullable and additive: existing rows (all non-video today) are
-- unaffected, and the media CHECK constraint (type='video' ⇒ vimeo_id not null)
-- is unchanged. duration_seconds already exists (spine migration) and is simply
-- populated by the same integration.

alter table public.content_items
  add column if not exists thumbnail_url text,
  add column if not exists vimeo_hash text;

comment on column public.content_items.thumbnail_url is
  'Poster/still URL (e.g. the Vimeo thumbnail CDN link). Null = show the typed placeholder. Public image, not private media.';
comment on column public.content_items.vimeo_hash is
  'Vimeo unlisted/private play hash (the ?h= token) so a non-public video embeds off-Vimeo. Null for public videos / non-video items.';
