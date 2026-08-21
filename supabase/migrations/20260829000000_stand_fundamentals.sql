-- ============================================================================
-- STAND — the daily fundamentals checklist from Anthony's published journal.
-- ============================================================================
-- The journal's "THE 5 FUNDAMENTALS: STAND" page, tracked one day at a time:
--   * Four daily discipline TICKS -- Hydration, Steps, Alcohol-free, Healthy
--     food -- the "non-negotiables" a member ticks off each day.
--   * Five reflective PROMPTS, one per letter of STAND:
--       S — Strength of connection   ("who did I connect with today?")
--       T — Try new things / learn   ("what did I learn today?")
--       A — Active lifestyle         ("what activity did I do today?")
--       N — Notice the more          ("what did I notice today?")
--       D — Do good for others       ("what did I do for someone today?")
--
-- This is SENSITIVE personal wellbeing data, treated EXACTLY like the morning/
-- night routines and step_entries: it lives in the `private` schema (not
-- exposed via the API -- see supabase/config.toml), is own-rows-only via RLS
-- (auth.uid() = user_id), and is referenced by NO aggregate anywhere. HR sees
-- nothing; ntitt_admin sees nothing. Do not add an aggregate over it.
--
-- One row per member per local day (unique user_id, entry_date). The four ticks
-- default false and are toggled independently from the Today board; the five
-- reflections are optional free text. A partial upsert (one tick, or just the
-- reflections) only touches the columns it sends, so ticking and reflecting are
-- independent writes against the same day's row.
create table private.stand_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  hydration boolean not null default false,
  steps boolean not null default false,
  alcohol_free boolean not null default false,
  healthy_food boolean not null default false,
  strength_of_connection text,
  try_new_things text,
  active_lifestyle text,
  notice_the_more text,
  do_good_for_others text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

grant select, insert, update, delete on private.stand_entries to authenticated;
alter table private.stand_entries enable row level security;

create policy "own stand entries only" on private.stand_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index stand_entries_user_date_idx on private.stand_entries (user_id, entry_date);
