-- ============================================================================
-- PHASE 9 (1/3) — Real photo upload for Community posts, replacing the
-- pasted-URL interim from Phase 7 (community_posts.image_url is unchanged --
-- see that migration's comment; it was already "ready for a real upload
-- pipeline later without a further migration").
--
-- Bucket is public-read: post photos are shown to every viewer the post's
-- own `scope`/RLS already allows, and a public bucket is no more exposed
-- than the pasted-arbitrary-URL images it replaces (anyone with the exact
-- URL could already view those). Uploads are restricted to the uploader's
-- own folder (`{auth.uid()}/...`) via the standard Supabase Storage
-- `storage.foldername()` policy pattern, so a user can only ever write
-- into their own prefix -- this is the actual boundary, not the public
-- read.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-images',
  'community-images',
  true,
  5242880, -- 5 MiB, matches the server action's own enforced limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- storage.objects already has RLS enabled by default in every Supabase
-- project; these policies add to it, not enable it fresh.

create policy "community images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'community-images');

create policy "users upload community images to their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'community-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete their own community images"
  on storage.objects for delete
  using (
    bucket_id = 'community-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
