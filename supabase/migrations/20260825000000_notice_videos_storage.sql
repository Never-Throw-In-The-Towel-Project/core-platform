-- ============================================================================
-- NOTICE VIDEO FILES (Notice Board PR2) — uploaded video files for a notice,
-- the fast-follow to PR1's Vimeo + image notices. The `notices` table already
-- carries `media_kind = 'video'` in its CHECK and a `video_path` column (added
-- unused in the PR1 migration precisely so this step doesn't churn the model);
-- this migration only adds the STORAGE bucket those columns point at.
--
-- Separate bucket from `notice-media` (which is images, 5 MiB) because video
-- files are an order of magnitude larger and need their own size + MIME limits.
-- Same public-read rationale as every other content bucket (a notice video is
-- shown to every member the notice's own visibility already allows); the real
-- boundary is the WRITE policy: ntitt_admin only, mirroring notice-media exactly.
--
-- Upload path: unlike images (small enough to stream through a Server Action's
-- 6 MiB body limit), video files are uploaded DIRECTLY from the browser to
-- Storage via a short-lived signed upload URL that a Server Action mints for the
-- ntitt_admin — so the file never passes through the Next.js server. The bucket
-- still enforces the size + MIME limits below on the actual PUT, regardless of
-- the token, so the signed URL can't be used to smuggle a disallowed file.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'notice-videos',
  'notice-videos',
  true,
  209715200, -- 200 MiB, matches the client-side + server-action enforced limit
  array['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg']
)
on conflict (id) do nothing;

create policy "notice videos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'notice-videos');

create policy "ntitt admins upload notice videos"
  on storage.objects for insert
  with check (
    bucket_id = 'notice-videos'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin')
  );

create policy "ntitt admins update notice videos"
  on storage.objects for update
  using (
    bucket_id = 'notice-videos'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin')
  );

create policy "ntitt admins delete notice videos"
  on storage.objects for delete
  using (
    bucket_id = 'notice-videos'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin')
  );
