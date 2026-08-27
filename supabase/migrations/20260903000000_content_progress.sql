-- ============================================================================
-- CONTENT PROGRESS — per-member video resume position ("Pick up where you left
-- off"). The member Library's redesign shows in-progress videos with a progress
-- bar and "N min left"; this is where that position lives.
--
-- SENSITIVE personal data, treated EXACTLY like the routines / STAND / step
-- entries: it lives in the `private` schema (not exposed via the API — see
-- supabase/config.toml), is own-rows-only via RLS (auth.uid() = user_id), and is
-- referenced by NO aggregate anywhere. What a member watches, and how far, is
-- theirs alone — HR sees nothing, ntitt_admin sees nothing. Do not add an
-- aggregate over it.
--
-- One row per member per content item (unique user_id, content_item_id), upserted
-- as the player reports progress. `position_seconds` is where to resume;
-- `duration_seconds` (captured from the player) drives the "N min left" label;
-- `completed` marks a finished watch so it drops off the resume shelf. The FK to
-- content_items cascades, so deleting an item cleans up its progress rows.
-- ============================================================================
create table private.content_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  position_seconds integer not null default 0,
  duration_seconds integer,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, content_item_id)
);

grant select, insert, update, delete on private.content_progress to authenticated;
alter table private.content_progress enable row level security;

create policy "own content progress only" on private.content_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The resume shelf lists a member's most-recently-touched items first.
create index content_progress_user_updated_idx on private.content_progress (user_id, updated_at desc);
