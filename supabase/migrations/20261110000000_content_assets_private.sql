-- ============================================================================
-- Lock down content-assets: the content library's documents/images go private.
-- ============================================================================
-- The content-assets bucket (spine, 20260812010000) was created PUBLIC, so the
-- app derived a permanent getPublicUrl for every uploaded document/image and
-- anyone holding that URL could read paid library material with no session at
-- all -- the same "no auth needed" exposure the A4 migration closed for member
-- community photos (20260922020000), still open for the content library.
--
-- After this migration the bucket is private and reads are gated behind an
-- authenticated session. content_items.asset_path has always stored the bare
-- OBJECT PATH (not a URL), so NO backfill is needed (unlike community-images):
-- the three render sites (the member watch page + its intercepting modal, and
-- the admin Brain grid) now mint short-lived SIGNED URLs at read time instead
-- of permanent public links -- see src/lib/content/brain.ts.
--
-- Mirrors the community-images lockdown exactly: private bucket + an
-- authenticated-only read policy. The ntitt_admin INSERT/UPDATE/DELETE policies
-- (spine migration) are left untouched -- they already fail closed for anon,
-- and only the read path was the hole. Content is NTITT-wide (not company
-- scoped), so any authenticated member may read it, same as before -- just with
-- a session now required.

-- 1. Flip the bucket to private. Existing getPublicUrl links stop resolving, and
--    the app no longer mints them (it signs the stored object path at read time).
update storage.buckets set public = false where id = 'content-assets';

-- 2. Replace the role-less public SELECT policy with an authenticated-only one.
--    Flipping `public` alone is not sufficient: the old policy still granted
--    read through the storage API regardless of the bucket flag.
drop policy if exists "content assets are publicly readable" on storage.objects;

create policy "authenticated users read content assets"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'content-assets'
    and auth.uid() is not null
  );
