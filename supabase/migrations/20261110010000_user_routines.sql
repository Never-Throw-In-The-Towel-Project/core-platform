-- ============================================================================
-- MY ROUTINES — a member's OWN recurring routines on the weekly planner.
-- ============================================================================
-- Unlike the fixed weekly framework (Morning/Night routines, the Mon–Fri themed
-- check-ins, the Weekly Review, Sunday Setup), these are USER-authored: the
-- member types a routine, picks which weekdays it runs, optionally sets a time,
-- and ticks it off each day from the Today board. Personal wellbeing data,
-- treated EXACTLY like stand_entries / habit_challenges: it lives in the
-- `private` schema (not exposed beyond the owner — see supabase/config.toml), is
-- own-rows-only via RLS (auth.uid() = user_id), and is referenced by NO
-- aggregate anywhere. HR sees nothing; ntitt_admin sees nothing. Do not add an
-- aggregate over it.
--
-- Non-punitive, like Clean Streak: a completion is a dated tick (one per routine
-- per local day); missing a day subtracts nothing. Retiring a routine sets
-- active = false rather than deleting it, so its completion history survives.
-- ============================================================================

-- ---- user_routines: one row per routine the member defines --------------------
create table private.user_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Free text the member types (e.g. "Gym", "Meditate 10 min"). Personal — never
  -- shared or reported.
  label text not null,
  -- Which ISO weekdays the routine runs on: 1 = Monday … 7 = Sunday. A non-empty
  -- subset the member picks; the server action sorts + de-duplicates it. The
  -- domain check keeps every element in 1..7 (`<@` = "contained by"); the length
  -- check keeps the set non-empty and within the seven days.
  weekdays smallint[] not null,
  -- Optional local time-of-day hint, for display + ordering. No timezone — the
  -- member's own local clock, like a line on a paper planner.
  time_of_day time,
  sort_order int not null default 0,
  -- Retire without deleting, so completion history survives (non-punitive).
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_routines_label_len check (char_length(label) between 1 and 80),
  -- cardinality() (not array_length) so an empty '{}' set is 0, not NULL — a
  -- NULL check passes, which would let an empty weekday set through.
  constraint user_routines_weekdays_len check (cardinality(weekdays) between 1 and 7),
  constraint user_routines_weekdays_domain check (weekdays <@ array[1,2,3,4,5,6,7]::smallint[])
);

grant select, insert, update, delete on private.user_routines to authenticated;
alter table private.user_routines enable row level security;

create policy "own routines only" on private.user_routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index user_routines_user_active_idx on private.user_routines (user_id, active);


-- ---- user_routine_completions: one tick per routine per local day -------------
create table private.user_routine_completions (
  id uuid primary key default gen_random_uuid(),
  -- Denormalised user_id (also reachable via the FK) so the own-rows RLS policy
  -- stays a simple auth.uid() = user_id, matching habit_check_ins. The server
  -- action only ever writes the member's own routine id (verified under their
  -- own session first), so a completion can't attach to someone else's routine.
  user_id uuid not null references auth.users (id) on delete cascade,
  routine_id uuid not null references private.user_routines (id) on delete cascade,
  completion_date date not null,                   -- the member's local day (todayISODate)
  created_at timestamptz not null default now(),
  unique (user_id, routine_id, completion_date)    -- one tick per day; tick/untick = insert/delete
);

grant select, insert, update, delete on private.user_routine_completions to authenticated;
alter table private.user_routine_completions enable row level security;

create policy "own routine completions only" on private.user_routine_completions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index user_routine_completions_routine_date_idx
  on private.user_routine_completions (routine_id, completion_date);

-- Like every private table: no policy here references hr_admin or ntitt_admin,
-- and nothing in the private -> public aggregation path reads these tables. A
-- member's personal routines are theirs alone. Do not add an aggregate over them.
