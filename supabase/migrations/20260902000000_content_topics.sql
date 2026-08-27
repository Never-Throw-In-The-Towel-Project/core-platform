-- ============================================================================
-- CONTENT TOPICS — a member-facing, editable topic taxonomy for the Library.
-- The redesigned Library (docs/CONTENT_PLATFORM_STRATEGY.md, the dark
-- "content-OS") browses by life-situation TOPIC — Addiction, Divorce, Grief,
-- Redundancy, Identity loss, Anxiety, Relationships, Purpose — as first-class
-- facets with real per-topic counts, not the free-text search shortcuts the
-- old page used. Topics are their own dimension, orthogonal to the broad
-- `video_category` "theme" (Mental/Physical/Nutrition/Tools) which stays.
--
-- Two additive tables:
--   * `content_topics` — the taxonomy itself, SEEDED with the eight above but
--     editable by an ntitt_admin in the Brain (add / rename / re-order / retire)
--     without a code change, per the product decision.
--   * `content_item_topics` — the many-to-many assignment. Populated by the AI
--     tagging pass (backfill + Vimeo-sync auto-tag) in a follow-up slice.
--
-- Reads: topics and their assignments are member-facing (the Library filter +
-- the "Browse by topic" rooms), so authenticated-read — the SAME shape as
-- `content_channel_placements` (a join read authenticated users need for the
-- count/filter joins to evaluate). Per-topic counts join to `content_items`,
-- whose own RLS still restricts to published + channel-visible rows, so a
-- member's counts never include drafts or content targeted at another company.
-- Writes are ntitt_admin only, mirroring the content spine exactly.
-- ============================================================================

-- ---- content_topics: the editable taxonomy ---------------------------------
create table public.content_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                        -- stable key for URLs/filters ('identity-loss')
  label text not null,                              -- display label ('Identity loss')
  sort_order integer not null default 0,            -- room ordering in the Library
  created_by uuid references public.profiles (id),  -- the authoring ntitt_admin; null for the seed
  created_at timestamptz not null default now()
);

alter table public.content_topics enable row level security;


-- ---- content_item_topics: the many-to-many assignment ----------------------
-- Composite PK makes (item, topic) unique and idempotent for the tagging pass;
-- both FKs cascade so deleting an item or a topic cleans up its assignments.
create table public.content_item_topics (
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  topic_id uuid not null references public.content_topics (id) on delete cascade,
  primary key (content_item_id, topic_id)
);

alter table public.content_item_topics enable row level security;

-- Reverse lookup (topic -> its items) for the per-topic count + room queries.
create index content_item_topics_topic_id_idx on public.content_item_topics (topic_id);


-- ---- RLS: reads (member-facing, like content) ------------------------------
create policy "authenticated read topics"
  on public.content_topics for select
  using (auth.role() = 'authenticated');

create policy "authenticated read item topics"
  on public.content_item_topics for select
  using (auth.role() = 'authenticated');


-- ---- RLS: writes are ntitt_admin only (mirrors the content spine) ----------
create policy "ntitt admins create topics"
  on public.content_topics for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins update topics"
  on public.content_topics for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins delete topics"
  on public.content_topics for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins create item topics"
  on public.content_item_topics for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins delete item topics"
  on public.content_item_topics for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));


-- ---- Seed the eight launch topics (idempotent) -----------------------------
-- Editable afterwards in the Brain; the slugs are the stable filter keys, so
-- rename the label freely but keep the slug once content is tagged against it.
insert into public.content_topics (slug, label, sort_order) values
  ('addiction',     'Addiction',     1),
  ('divorce',       'Divorce',       2),
  ('grief',         'Grief',         3),
  ('redundancy',    'Redundancy',    4),
  ('identity-loss', 'Identity loss', 5),
  ('anxiety',       'Anxiety',       6),
  ('relationships', 'Relationships', 7),
  ('purpose',       'Purpose',       8)
on conflict (slug) do nothing;
