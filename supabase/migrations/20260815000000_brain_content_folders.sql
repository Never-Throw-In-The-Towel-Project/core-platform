-- ============================================================================
-- BRAIN KNOWLEDGE BASE — folders for the content spine. The Super Admin "Brain"
-- (Anthony's team) organises the content_items spine into named folders and a
-- visual grid, richly tagged, so the AI brain has an organised substrate to
-- sort/arrange and serve from. See docs/CONTENT_PLATFORM_STRATEGY.md and
-- supabase/migrations/20260812010000_content_platform_spine.sql.
--
-- This is additive and non-destructive: it adds a `content_folders` table and a
-- nullable `content_items.folder_id` pointer. Folders are a purely INTERNAL
-- organising concept for the Brain — members never see them — so, unlike
-- content_items (which authenticated users read when published), folders are
-- ntitt_admin-only for BOTH read and write. The write-policy shape mirrors the
-- content spine's ntitt_admin policies exactly (verified live by the migration
-- harness the same way).
--
-- Un-filing, not cascading: `folder_id` is `on delete set null`, so deleting a
-- folder un-files its items (they fall back to "Unfiled") rather than deleting
-- any content. Content lifecycle stays owned by content_items alone.
-- ============================================================================

-- ---- content_folders: the Brain's organising unit -------------------------
create table public.content_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.profiles (id),  -- the authoring ntitt_admin
  created_at timestamptz not null default now()
);

alter table public.content_folders enable row level security;


-- ---- content_items.folder_id: which Brain folder an item lives in ---------
-- Nullable: null = "Unfiled". `set null` on folder delete keeps the content and
-- simply un-files it (see header). Indexed for the per-folder grid query.
alter table public.content_items
  add column folder_id uuid references public.content_folders (id) on delete set null;

create index content_items_folder_id_idx on public.content_items (folder_id);


-- ---- RLS: folders are ntitt_admin-only, all operations --------------------
-- Folders carry no member-facing or personal data; they are the Super Admin's
-- own filing system. Same ntitt_admin gate the content spine uses for writes,
-- applied here to reads too. content_items keeps its own (unchanged) policies —
-- adding a nullable column doesn't alter who may read a row.
create policy "ntitt admins read folders"
  on public.content_folders for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins create folders"
  on public.content_folders for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins update folders"
  on public.content_folders for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins delete folders"
  on public.content_folders for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));
