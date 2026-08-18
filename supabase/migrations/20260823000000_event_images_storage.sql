-- ============================================================================
-- Event images — real uploads for events.image_url, replacing the pasted-URL
-- field on the authoring form. `events.image_url` is UNCHANGED (still text): it
-- now holds the public URL of an uploaded asset in this bucket, or — for events
-- created before this — a previously-pasted URL. Both render identically, so no
-- data migration is needed.
--
-- Public-read, same rationale as community-images (Phase 9) and content-assets
-- (content spine): an event image is shown to everyone the event's own
-- visibility already allows, and a public bucket is no more exposed than the
-- arbitrary URLs it replaces (anyone with the exact URL could already view
-- those). The real boundary is the WRITE policy: only an event AUTHOR may
-- upload/replace/delete — an ntitt_admin (global events) or an hr_admin (their
-- own company's) — and only within their own `{auth.uid()}/` folder (the
-- standard storage.foldername prefix pattern). content-assets is ntitt-admin
-- only, which is why events needs its own bucket: hr_admins author events too.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-images',
  'event-images',
  true,
  5242880, -- 5 MiB, matches the server action's own enforced limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- storage.objects already has RLS enabled by default in every Supabase project;
-- these policies add to it, not enable it fresh.

create policy "event images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'event-images');

create policy "event authors upload event images to their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('ntitt_admin', 'hr_admin')
    )
  );

create policy "event authors update their own event images"
  on storage.objects for update
  using (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('ntitt_admin', 'hr_admin')
    )
  );

create policy "event authors delete their own event images"
  on storage.objects for delete
  using (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('ntitt_admin', 'hr_admin')
    )
  );
