-- ============================================================================
-- CHALLENGES — the "container" pillar (docs/CONTENT_PLATFORM_STRATEGY.md
-- "Pillar 3"). A challenge is an ordered programme of days that sequences the
-- content spine (content_items): a 28-day reset, a 90-day rebuild, an ad-hoc
-- run. Anthony authors a challenge in the Studio; a member enrols and works
-- through the days at their own pace.
--
-- Two halves, split exactly on the platform's privacy line
-- (docs/ARCHITECTURE.md "private vs public"):
--   * PUBLIC — the *definition* is shared content: `challenges` (title, theme,
--     length) and `challenge_days` (day_index → a content_item). Written by
--     ntitt_admin only; read by any authenticated member when published. The
--     RLS shape mirrors `content_items` from the spine migration exactly.
--   * PRIVATE — a member's *participation* is personal: `challenge_enrollments`
--     (I joined this) and `challenge_day_completions` (I finished this day).
--     These live in the `private` schema behind own-rows-only RLS, the same
--     boundary as morning_entries / themed_checkins.
--
-- THE "NO DAY NUMBERS" PRINCIPLE, HONOURED BY THE DATA MODEL ITSELF.
-- docs/ARCHITECTURE.md records Anthony's guidance against day counters, because
-- a "you're on day 3, 25 to go" counter reads as failure the moment someone
-- dips out. This schema makes that failure mode *unrepresentable*: there is no
-- start-date, no expected-day, no elapsed-day anywhere. Progress is derived
-- purely as COUNT(completions) out of the challenge length — a number that only
-- ever rises and is never compared against a clock. `day_index` is an authoring
-- sequence label ("Day 1, Day 2 …" of the programme), not a countdown against
-- the calendar. (This is also consistent with the since-revised Rail "Day N"
-- decision in src/lib/routines/dayState.ts.) It remains an Anthony sign-off
-- item on presentation; the storage layer is deliberately neutral.
--
-- Additive and non-destructive. No existing table is touched.
-- ============================================================================


-- ---- challenges: the programme definition (public, ntitt_admin-authored) ----
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  -- Reuses the existing theme taxonomy, same as content_items.category, so a
  -- challenge sits in the same Mental/Physical/Nutrition/Tools grid as its content.
  category public.video_category not null,
  length_days smallint not null check (length_days between 1 and 366),
  is_published boolean not null default false,   -- Studio drafts, then publishes
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.challenges enable row level security;


-- ---- challenge_days: the ordered content sequence (public) -------------------
-- One row per day of the programme. `content_item_id` is nullable and ON DELETE
-- SET NULL: a day usually points at a spine item, but may be a pure prompt
-- (rest day, reflection) with just a `prompt`, and deleting a content item must
-- not delete the day out from under the challenge -- it degrades to a prompt.
-- Note: the linked content_item still carries its OWN channel-placement RLS, so
-- a member only sees a day's content if their channel is allowed it. Challenges
-- themselves are NTITT-wide in this slice (no per-challenge channel targeting
-- yet); author global challenges from global content. Per-challenge channels
-- are a later, additive increment.
create table public.challenge_days (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  day_index smallint not null check (day_index between 1 and 366),
  content_item_id uuid references public.content_items (id) on delete set null,
  prompt text,                                   -- optional guidance/label for the day
  created_at timestamptz not null default now(),
  unique (challenge_id, day_index)
);

alter table public.challenge_days enable row level security;


-- ---- RLS: reads (mirrors the content spine) ---------------------------------
-- Any authenticated member reads a PUBLISHED challenge and its days. Two
-- permissive SELECT policies (Postgres ORs them) add the Studio's draft view,
-- same pattern as content_items.
create policy "authenticated read published challenges"
  on public.challenges for select
  using (auth.role() = 'authenticated' and is_published);

create policy "ntitt admins read all challenges"
  on public.challenges for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "authenticated read days of published challenges"
  on public.challenge_days for select
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.challenges c
      where c.id = challenge_days.challenge_id and c.is_published
    )
  );

create policy "ntitt admins read all challenge days"
  on public.challenge_days for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));


-- ---- RLS: writes are ntitt_admin only (mirrors content_items) ----------------
create policy "ntitt admins create challenges"
  on public.challenges for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins update challenges"
  on public.challenges for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins delete challenges"
  on public.challenges for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins create challenge days"
  on public.challenge_days for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins update challenge days"
  on public.challenge_days for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins delete challenge days"
  on public.challenge_days for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));


-- ============================================================================
-- PRIVATE: a member's participation. Own-rows-only, exactly like the wellbeing
-- journals in the init migration. auth.uid() = user_id is the whole boundary;
-- no policy ever grants an hr_admin or ntitt_admin a peek at who enrolled or
-- how far they got -- participation is as private as a night entry.
-- ============================================================================

create table private.challenge_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Deliberately NO started_on / expected-day column: see the "no day numbers"
  -- note in this file's header. Progress is completion-count only.
  unique (user_id, challenge_id)
);

create table private.challenge_day_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Keyed to the specific day row; ON DELETE CASCADE so re-authoring a day
  -- cleans up its completions. Independent of the enrollment row's lifecycle:
  -- leaving a challenge (deleting the enrollment) intentionally KEEPS the
  -- completions, so re-joining resumes progress rather than punishing a pause.
  challenge_day_id uuid not null references public.challenge_days (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,  -- denormalised for cheap per-challenge counts
  completed_at timestamptz not null default now(),
  unique (user_id, challenge_day_id)
);

-- `alter default privileges` in the init migration only applies to tables made
-- in a *later* session; these are created now, so grant explicitly (same note
-- as the init migration's private grants). These two additionally grant DELETE,
-- unlike the append-only wellbeing journals: they are user-controlled toggles
-- the member fully owns -- leave a challenge (delete enrollment), un-tick a day
-- (delete completion). RLS still confines every verb to the owner's own rows.
grant select, insert, update, delete on
  private.challenge_enrollments,
  private.challenge_day_completions
to authenticated;

alter table private.challenge_enrollments enable row level security;
alter table private.challenge_day_completions enable row level security;

create policy "own challenge enrollments only" on private.challenge_enrollments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own challenge day completions only" on private.challenge_day_completions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
