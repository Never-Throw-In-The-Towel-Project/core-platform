-- ============================================================================
-- NOTICE BOARD — an ad-hoc "promo card" Anthony (ntitt_admin) can surface on the
-- members' Today page: a Monday motivational video, an event shout-out, a quick
-- Christmas-Day message. One flexible card per slot, scheduled by weekday and/or
-- a date window, carrying at most one piece of media plus an optional call to
-- action. See docs — this is the Notice Board widget on /home.
--
-- It sits ALONGSIDE the content spine, not inside it: content_items is the
-- durable, taggable library that the day-of-week carousels + challenges + Brain
-- all read from, and its media CHECK deliberately forbids an uploaded video and
-- has no date-window column. A notice is the opposite shape — ephemeral,
-- date-bounded, single-card — so it earns its own small table rather than
-- straining the spine's invariants.
--
-- GLOBAL + Super-Admin-only. Unlike events/content there is no per-company
-- targeting in this feature: a published notice is shown to EVERY member, all
-- tenants (the scoping the user chose). Writes are ntitt_admin only — the policy
-- shape mirrors the content spine exactly. Never granted to `anon`: notices are
-- a members'-app surface, never on the logged-out marketing site.
--
-- media_kind is the discriminant. 'none' = text-only card; 'vimeo' = a Vimeo id
-- (the same no-ads host the content library uses); 'image' = an uploaded image
-- in the new `notice-media` bucket; 'video' = an uploaded video FILE. The
-- 'video' kind + `video_path` column exist NOW (in the CHECK, in the table) so
-- the model doesn't churn, but nothing writes them until the PR2 fast-follow
-- adds the video bucket + direct-upload path — exactly the "columns exist now so
-- the model doesn't churn" pattern the events guest columns used.
--
-- Additive and non-destructive: no existing table is touched.
-- ============================================================================

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,                            -- the headline shown on the card
  body text,                                      -- optional supporting copy
  -- Exactly one media shape per kind (checked below). 'none' carries none.
  media_kind text not null default 'none'
    check (media_kind in ('none', 'vimeo', 'image', 'video')),
  vimeo_id text,                                  -- media_kind = 'vimeo'
  image_path text,                                -- media_kind = 'image' (object path in `notice-media`)
  video_path text,                                -- media_kind = 'video' (reserved for the PR2 video bucket; unused until then)
  -- Optional call to action. A label with no url is meaningless, so the CHECK
  -- forbids it; a url with no label is fine (the widget falls back to a default).
  cta_label text,
  cta_url text,
  -- Scheduling. weekday: ISO 1 = Monday … 7 = Sunday, null = shows any weekday.
  -- starts_on/ends_on: an inclusive date window in the member's day; either null
  -- = unbounded on that side, both null = always (subject to weekday). The window
  -- + weekday are applied in the QUERY layer (like events' freshness filtering),
  -- not in RLS — RLS only gates published + role.
  weekday smallint check (weekday between 1 and 7),
  starts_on date,
  ends_on date,
  is_published boolean not null default false,    -- Studio drafts, then publishes
  priority int not null default 0,                -- higher = surfaced first when several qualify
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notices_media_for_kind check (
    media_kind = 'none'
    or (media_kind = 'vimeo' and vimeo_id is not null)
    or (media_kind = 'image' and image_path is not null)
    or (media_kind = 'video' and video_path is not null)
  ),
  constraint notices_date_window_chk check (
    starts_on is null or ends_on is null or ends_on >= starts_on
  ),
  constraint notices_cta_label_needs_url check (
    cta_url is not null or cta_label is null
  )
);

alter table public.notices enable row level security;

-- The Today widget queries "published + within window + weekday matches today",
-- ordered by priority. Index the columns that gate + order that read.
create index notices_published_priority_idx
  on public.notices (is_published, priority desc);
create index notices_window_idx on public.notices (starts_on, ends_on);


-- ---- grants ----------------------------------------------------------------
-- `alter default privileges` in the init migration only covers tables made in a
-- later session; this is new, so grant explicitly (same note as content_items /
-- events). NEVER granted to anon — notices are a members'-app surface only.
grant select, insert, update, delete on public.notices to authenticated;


-- ---- RLS: reads ------------------------------------------------------------
-- Any authenticated member reads PUBLISHED notices (global — no per-company
-- scoping in this feature). The weekday + date-window filtering happens in the
-- query layer, not here, so a member with a bad clock can never be shown a draft.
create policy "authenticated read published notices"
  on public.notices for select
  using (auth.role() = 'authenticated' and is_published);

-- The Studio needs every notice, including unpublished drafts. Separate
-- permissive SELECT policy (Postgres ORs permissive policies), same pattern as
-- "ntitt admins read all content".
create policy "ntitt admins read all notices"
  on public.notices for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));


-- ---- RLS: writes are ntitt_admin only (mirrors the content spine) -----------
create policy "ntitt admins create notices"
  on public.notices for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins update notices"
  on public.notices for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins delete notices"
  on public.notices for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));


-- ---- notice-media Storage bucket (uploaded images) -------------------------
-- Same public-read rationale as content-assets / event-images: a notice image is
-- shown to every member the notice's own visibility already allows, and a public
-- bucket is no more exposed than that. The real boundary is the WRITE policy:
-- only an ntitt_admin may upload/replace/delete — this is a Super-Admin-only
-- surface, so (unlike event-images, which hr_admins also write) it needs no
-- per-author folder scoping; it mirrors content-assets exactly.
--
-- Images only in this bucket. Uploaded VIDEO files (media_kind='video') land in a
-- SEPARATE bucket with its own size/MIME limits + a direct-upload path, added in
-- the PR2 fast-follow — not here.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'notice-media',
  'notice-media',
  true,
  5242880, -- 5 MiB, matches the server action's own enforced image limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "notice media are publicly readable"
  on storage.objects for select
  using (bucket_id = 'notice-media');

create policy "ntitt admins upload notice media"
  on storage.objects for insert
  with check (
    bucket_id = 'notice-media'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin')
  );

create policy "ntitt admins update notice media"
  on storage.objects for update
  using (
    bucket_id = 'notice-media'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin')
  );

create policy "ntitt admins delete notice media"
  on storage.objects for delete
  using (
    bucket_id = 'notice-media'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin')
  );
