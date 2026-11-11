-- ============================================================================
-- Lock down the notice buckets: notice-media + notice-videos go private.
-- ============================================================================
-- Both notice buckets (20260824000000_notices, 20260825000000_notice_videos_
-- storage) were created PUBLIC, so the app derived a permanent getPublicUrl for
-- every uploaded notice image/video and anyone holding that URL could read it
-- with no session at all — the same "no auth needed" exposure the A4
-- (community-images, 20260922020000) and content-assets (20261110000000)
-- lockdowns closed, still open for notice media.
--
-- After this migration both buckets are private and reads are gated behind an
-- authenticated session. notices.image_path / video_path have always stored the
-- bare OBJECT PATH (not a URL), so NO backfill is needed (like content-assets):
-- the read site (src/lib/notices/queries.ts via noticeImageUrl / noticeVideoUrl)
-- now mints short-lived SIGNED URLs at read time instead of permanent public
-- links.
--
-- Mirrors the content-assets lockdown exactly: private bucket + an
-- authenticated-only read policy per bucket. The ntitt_admin INSERT/UPDATE/
-- DELETE policies (the two notice-storage migrations) are left untouched — they
-- already fail closed for anon, and only the read path was the hole. A notice is
-- shown to every member its own visibility already allows, so any authenticated
-- member may read the media — same as before, just with a session now required.
--
-- DEPLOY ORDER: the signed-URL code must ship BEFORE this migration.
-- createSignedUrl works on a public OR private bucket, but the old getPublicUrl
-- links 403 once the bucket is private — so deploy the code first, then apply
-- this (same ordering as the content-assets lockdown).

-- 1. Flip both buckets to private. Existing getPublicUrl links stop resolving,
--    and the app no longer mints them (it signs the stored object path at read
--    time).
update storage.buckets set public = false where id in ('notice-media', 'notice-videos');

-- 2. Replace each role-less public SELECT policy with an authenticated-only one.
--    Flipping `public` alone is not sufficient: the old policy still granted read
--    through the storage API regardless of the bucket flag.
drop policy if exists "notice media are publicly readable" on storage.objects;
drop policy if exists "notice videos are publicly readable" on storage.objects;

create policy "authenticated users read notice media"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'notice-media'
    and auth.uid() is not null
  );

create policy "authenticated users read notice videos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'notice-videos'
    and auth.uid() is not null
  );
