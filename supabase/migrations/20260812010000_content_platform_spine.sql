-- ============================================================================
-- CONTENT PLATFORM SPINE — generalise content from "Vimeo videos only" into a
-- typed, taggable content model that the day-of-week carousels, challenges,
-- channel targeting, and (later) the AI brain all read from. See
-- docs/CONTENT_PLATFORM_STRATEGY.md "The architectural spine: content_items".
--
-- This is additive and non-destructive. `public.content_videos` is NOT
-- dropped: `workout_week_exercises` still FKs its `id` (the Workout Wednesday
-- demo links, Phase 2) and `src/lib/routines/workouts.ts` still reads it.
-- Existing `content_videos` rows are BACKFILLED (id-preserving) into
-- `content_items`, and the Content Library reads `content_items` going
-- forward; retiring `content_videos` entirely (migrating those FKs) is a
-- separate, later migration, not this one.
--
-- Two new dimensions define the spine:
--   * `content_channel_placements` — the per-partner targeting join. ZERO
--     placement rows for an item = NTITT-wide (visible to every channel, the
--     current behaviour); a row per company restricts/targets it. This keeps
--     "built once, runs everywhere" the default and makes targeting purely
--     additive (docs/ARCHITECTURE.md "Core platform vs. co-branded portals").
--   * `day_of_week` — nullable ISO weekday (1 = Monday … 7 = Sunday). Nullable
--     because most content is day-agnostic; a nullable smallint (rather than
--     extending the Mon–Fri `weekday_theme` enum) covers the full Mon–SUN grid
--     without enum-add friction.
--
-- Writes are `ntitt_admin` only — the first app-written content in the
-- platform (all prior content arrived via Supabase Studio / service_role).
-- The policy shape mirrors the Phase 7 community moderation policies exactly.
-- ============================================================================

-- A brand-new enum TYPE used in the same migration is fine — the Postgres
-- "can't use it in the transaction that created it" restriction applies only
-- to a newly-added enum VALUE (ALTER TYPE ... ADD VALUE), not to CREATE TYPE.
create type public.content_type as enum ('video', 'document', 'image');


-- ---- content_items: the spine ----------------------------------------------
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  type public.content_type not null,
  title text not null,
  summary text,                               -- description / AI summary (later)
  -- The "theme" dimension. Reuses the existing video_category enum so the
  -- Library's category tabs keep working unchanged and the backfill maps 1:1;
  -- broadening the taxonomy (motivation, mindfulness, …) is a later ADD VALUE.
  category public.video_category not null,
  day_of_week smallint check (day_of_week between 1 and 7),  -- ISO 1=Mon..7=Sun, null = day-agnostic
  -- Media: exactly one shape per type (checked below). Video keeps Vimeo (the
  -- deliberate no-ads/consent-friendly host); document/image use a Storage
  -- path in the `content-assets` bucket, or an external URL.
  vimeo_id text,
  asset_path text,                            -- object path within `content-assets`
  external_url text,
  tags text[] not null default '{}',
  workout_tier public.workout_tier,           -- carried over; only set for workout demos
  duration_seconds integer,
  is_published boolean not null default false, -- Studio drafts, then publishes; readers see published only
  created_by uuid references public.profiles (id),  -- the authoring ntitt_admin; null for backfilled rows
  created_at timestamptz not null default now(),
  constraint content_items_media_for_type check (
    (type = 'video'    and vimeo_id is not null)
    or (type = 'document' and (asset_path is not null or external_url is not null))
    or (type = 'image'    and (asset_path is not null or external_url is not null))
  )
);

alter table public.content_items enable row level security;


-- ---- content_channel_placements: per-partner targeting ---------------------
create table public.content_channel_placements (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  priority integer not null default 0,        -- higher = surfaced first for that channel
  created_at timestamptz not null default now(),
  unique (content_item_id, company_id)
);

alter table public.content_channel_placements enable row level security;


-- ---- RLS: reads --------------------------------------------------------------
-- Any authenticated user reads PUBLISHED content that is either global (no
-- placement rows) or placed on their own company. The placement sub-selects
-- must be able to see placement rows, hence the authenticated read policy on
-- content_channel_placements below — otherwise every item would read as
-- global and targeted content would leak platform-wide.
create policy "authenticated read published visible content"
  on public.content_items for select
  using (
    auth.role() = 'authenticated'
    and is_published
    and (
      not exists (
        select 1 from public.content_channel_placements cp
        where cp.content_item_id = content_items.id
      )
      or exists (
        select 1 from public.content_channel_placements cp
        where cp.content_item_id = content_items.id
          and cp.company_id = (select p.company_id from public.profiles p where p.id = auth.uid())
      )
    )
  );

-- The Studio needs to see everything, including unpublished drafts. Separate
-- permissive SELECT policy (Postgres ORs permissive policies together), same
-- pattern as the Phase 7 "ntitt admins read all community posts".
create policy "ntitt admins read all content"
  on public.content_items for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

-- Placement rows are not personal/sensitive data; authenticated read is
-- required for the visibility sub-selects above to evaluate correctly.
create policy "authenticated read content placements"
  on public.content_channel_placements for select
  using (auth.role() = 'authenticated');


-- ---- RLS: writes are ntitt_admin only (mirrors Phase 7 moderation) ----------
create policy "ntitt admins create content"
  on public.content_items for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins update content"
  on public.content_items for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins delete content"
  on public.content_items for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins create placements"
  on public.content_channel_placements for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins update placements"
  on public.content_channel_placements for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins delete placements"
  on public.content_channel_placements for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));


-- ---- Backfill existing videos into the spine (id-preserving, idempotent) ----
-- content_videos is empty in practice today, but copy any rows faithfully so
-- the Library loses nothing on cutover. Marked published (existing content was
-- already live); no channel rows, so each stays NTITT-wide as before.
insert into public.content_items
  (id, type, title, category, vimeo_id, tags, workout_tier, duration_seconds, is_published, created_at)
select
  id, 'video', title, category, vimeo_id, tags, workout_tier, duration_seconds, true, created_at
from public.content_videos
on conflict (id) do nothing;


-- ---- content-assets Storage bucket (documents + images) ---------------------
-- Same public-read rationale as `community-images` (Phase 9): content is shown
-- to every viewer the item's own RLS/placement already allows, and a public
-- bucket is no more exposed than that. The real boundary is the WRITE policy:
-- only an ntitt_admin may upload/replace/delete a content asset.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-assets',
  'content-assets',
  true,
  26214400, -- 25 MiB (documents/PDFs run larger than community photos)
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
on conflict (id) do nothing;

create policy "content assets are publicly readable"
  on storage.objects for select
  using (bucket_id = 'content-assets');

create policy "ntitt admins upload content assets"
  on storage.objects for insert
  with check (
    bucket_id = 'content-assets'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin')
  );

create policy "ntitt admins update content assets"
  on storage.objects for update
  using (
    bucket_id = 'content-assets'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin')
  );

create policy "ntitt admins delete content assets"
  on storage.objects for delete
  using (
    bucket_id = 'content-assets'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin')
  );
