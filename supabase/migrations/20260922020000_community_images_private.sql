-- ============================================================================
-- Community anonymity, part 4 (A4): make member-uploaded photos private.
-- ============================================================================
-- The community-images bucket (Phase 9, 20260731040000) was created PUBLIC: the
-- upload path stored a full public URL in community_posts.image_url, and anyone
-- holding that URL could fetch a member's uploaded photo with no session at all
-- -- the same "no auth needed" exposure A1 closed for the post TEXT, still open
-- for the image behind it. The A1 migration (20260922000000) explicitly named
-- this public bucket as the A4 follow-up.
--
-- After this migration the bucket is private and reads are gated behind an
-- authenticated session, so a member's photo is visible only to signed-in
-- members. The app serves short-lived SIGNED URLs at read time
-- (signCommunityImageUrls in src/lib/community/imageUpload.ts, called from
-- getPosts) instead of permanent public links.

-- 1. Flip the bucket to private. Existing getPublicUrl links stop resolving, and
--    the app no longer mints them (imageUpload now stores the object path).
update storage.buckets set public = false where id = 'community-images';

-- 2. Replace the role-less public SELECT policy with an authenticated-only one.
--    Flipping `public` alone is NOT sufficient: this policy still granted read
--    through the storage API's authenticated/anon path regardless of the bucket
--    flag. `to authenticated` + `auth.uid() is not null` is the same anon-lock
--    shape A1 applied to community_posts / community_comments. INSERT and DELETE
--    are already own-folder-scoped by auth.uid() (they fail closed for anon), so
--    they are left as-is; only the read path was the hole.
drop policy if exists "community images are publicly readable" on storage.objects;

create policy "authenticated users read community images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'community-images'
    and auth.uid() is not null
  );

-- 3. Backfill: rows written before this migration hold a full public URL; store
--    just the object path ({userId}/{uuid}.ext) so read-time signing is uniform
--    for old and new rows. Strips everything up to and including the bucket
--    segment. Idempotent: a value with no '/community-images/' segment (already
--    a bare path, or null) is not matched and left untouched.
update public.community_posts
   set image_url = substring(image_url from '/community-images/(.*)$')
 where image_url like '%/community-images/%';
