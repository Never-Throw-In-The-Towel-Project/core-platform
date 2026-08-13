-- ============================================================================
-- GAMIFICATION (Track 2 · D2, part 1): self-reported daily steps.
-- ============================================================================
-- A member's steps are a health metric, so they are treated EXACTLY like
-- sleep_score and day_rating: PRIVATE and NEVER reportable. This table lives in
-- the `private` schema (not exposed via the API -- see supabase/config.toml),
-- is own-rows-only via RLS (auth.uid() = user_id), and is referenced by NO
-- aggregate anywhere. HR sees nothing; only the member sees their own steps.
--
-- "Self-reported first" (docs/ROADMAP.md D2): a plain integer the member enters,
-- no device integration yet. One row per (user, day); re-logging updates it.

create table private.step_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  steps integer not null check (steps >= 0 and steps <= 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

grant select, insert, update, delete on private.step_entries to authenticated;

alter table private.step_entries enable row level security;

create policy "own step entries only" on private.step_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Like every private table: no policy here references hr_admin or ntitt_admin,
-- and nothing in the private -> public aggregation path reads this table. Steps
-- are the member's alone. Do not add an aggregate over this table.
