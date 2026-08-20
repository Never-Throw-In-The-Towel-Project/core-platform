-- ============================================================================
-- CLEAN STREAK (the "Bad Habit Board") — a member's OWN habit-quit challenge and
-- their daily clean/slip check-ins. This is SENSITIVE recovery data (smoking,
-- gambling, drugs, alcohol), so it is treated EXACTLY like step_entries / sleep_
-- score / day_rating: it lives in the `private` schema (not exposed via the API
-- -- see supabase/config.toml), is own-rows-only via RLS (auth.uid() = user_id),
-- and is referenced by NO aggregate anywhere. HR sees nothing; ntitt_admin sees
-- nothing; only the member sees their own recovery journey.
--
-- Unlike the admin `challenges` spine (ntitt_admin-authored programmes a member
-- can only enrol in), these are USER-authored: the member types the habit they
-- want to quit, chooses the length (1..366 days), can EXTEND it, and marks each
-- day themselves. NON-PUNITIVE by design: progress is the COUNT of clean days
-- (not a consecutive streak that a slip would reset); a slip is a private, dated
-- record that never erases progress. The habit_label is free text and sensitive,
-- so it must never be joined into any public or shared surface.
-- ============================================================================

-- ---- habit_challenges: one per habit the member is quitting ------------------
create table private.habit_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Free text the member types (e.g. "no smoking"). SENSITIVE -- private, never
  -- shared. The wins-share flow deliberately does not read this column.
  habit_label text not null,
  target_days int not null check (target_days between 1 and 366),  -- extend = raise this
  started_on date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on private.habit_challenges to authenticated;
alter table private.habit_challenges enable row level security;

create policy "own habit challenges only" on private.habit_challenges
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index habit_challenges_user_status_idx on private.habit_challenges (user_id, status);


-- ---- habit_check_ins: one clean/slip mark per day per challenge --------------
create table private.habit_check_ins (
  id uuid primary key default gen_random_uuid(),
  -- Denormalised (also reachable via the FK) so the own-rows RLS policy stays a
  -- simple auth.uid() = user_id, matching challenge_day_completions. The server
  -- action only ever writes the member's own challenge id (verified under their
  -- own session first), so a check-in can't attach to someone else's challenge.
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_challenge_id uuid not null references private.habit_challenges (id) on delete cascade,
  check_in_date date not null,                       -- the member's local day (todayISODate)
  outcome text not null check (outcome in ('success', 'slip')),  -- clean day vs. a slip
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, habit_challenge_id, check_in_date)  -- one mark per day; re-marking updates it
);

grant select, insert, update, delete on private.habit_check_ins to authenticated;
alter table private.habit_check_ins enable row level security;

create policy "own habit check-ins only" on private.habit_check_ins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index habit_check_ins_challenge_date_idx on private.habit_check_ins (habit_challenge_id, check_in_date);

-- Like every private table: no policy here references hr_admin or ntitt_admin,
-- and nothing in the private -> public aggregation path reads these tables. A
-- member's recovery journey is theirs alone. Do not add an aggregate over them.
