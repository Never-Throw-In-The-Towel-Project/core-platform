-- ============================================================================
-- GAMIFICATION (Track 2 · D2): the COMPANY STEP CHALLENGE (brief §2/§4).
-- ============================================================================
-- A monthly, opt-in, COLLECTIVE team step target -- deliberately NOT an
-- individual leaderboard (Anthony's brief: winners/losers discourage exactly the
-- people this platform is for). The privacy line is the whole design:
--
--   * Individual steps stay in private.step_entries, own-rows-only, and are
--     NEVER exposed to a company. A company only ever sees an AGGREGATE.
--   * That aggregate is produced ONE-WAY (private -> public) by the service-role
--     cron job (src/app/api/jobs/aggregate-step-challenges), the same rail the
--     participation rollups use. No end-user client can read a private step row
--     across users; only the service role (which bypasses RLS) can.
--   * A k-anonymity FLOOR: the team total is SUPPRESSED until at least
--     STEP_CHALLENGE_MIN_CONTRIBUTORS (5, see src/lib/steps/challenge.ts) members
--     have contributed, so a small team's total can't back out one person's
--     steps. Enforced in the aggregation writer, so a suppressed total is stored
--     as 0 and never lands in a table the company can read.
--   * Opting out is PRIVATE: the opt-in table is own-rows-only, so no one -- not
--     even HR -- can see who has or hasn't opted in; the dashboard sees only
--     counts.
--   * INVITED companies only: never the shared self-signup pool ("NTITT Direct",
--     which pools unrelated individuals), enforced here by a CHECK against that
--     seeded id (src/lib/tenant/constants.ts DIRECT_COMPANY_ID).

-- ---- The challenge definition (HR-authored, company-scoped) -----------------
create table public.company_step_challenges (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  title text not null,
  target_steps bigint not null check (target_steps > 0),
  reward_type text not null check (reward_type in (
    'team_experience', 'extra_day_off', 'charity_donation', 'prize_draw', 'anthony_visit'
  )),
  reward_name text not null,                 -- the human reward text HR enters
  starts_on date not null,
  ends_on date not null,
  -- 'pending_confirmation' is used by the Anthony-visit reward (awaiting his
  -- email confirmation) before it can go 'active'; kept in the enum now so that
  -- flow needs no later migration.
  status text not null default 'draft'
    check (status in ('draft', 'pending_confirmation', 'active', 'completed', 'cancelled')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  -- Invited clients only: the shared self-signup pool aggregates unrelated
  -- individuals, so a "team" total there is meaningless AND a privacy risk.
  check (company_id <> '00000000-0000-0000-0000-000000000001')
);

-- At most one active challenge per company at a time, so the aggregate and the
-- staff screen are unambiguous about which challenge "the" progress refers to.
create unique index one_active_challenge_per_company
  on public.company_step_challenges (company_id)
  where status = 'active';

alter table public.company_step_challenges enable row level security;

-- HR admins manage challenges for their OWN company only (mirrors the aggregate
-- tables: looked up by the admin's own company_id from their own profile row).
create policy "hr admins read their own company challenges"
  on public.company_step_challenges for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'hr_admin'
      and p.company_id = company_step_challenges.company_id
  ));
create policy "hr admins create their own company challenges"
  on public.company_step_challenges for insert
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'hr_admin'
      and p.company_id = company_step_challenges.company_id
  ));
create policy "hr admins update their own company challenges"
  on public.company_step_challenges for update
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'hr_admin'
      and p.company_id = company_step_challenges.company_id
  ));

-- Employees may READ their own company's NON-draft challenges (the staff
-- challenge screen). Draft challenges stay HR-only until launched. Exposes only
-- the challenge meta (title, target, reward, dates) -- never any member's steps.
create policy "employees read their own company launched challenges"
  on public.company_step_challenges for select
  using (
    status <> 'draft'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.company_id = company_step_challenges.company_id
    )
  );

-- ---- Per-member opt-in (PRIVATE, own-rows-only) -----------------------------
-- Default is opted-in (brief): a member with no row, or opted_in = true, is
-- included; only an explicit opted_in = false excludes them. Own-rows-only, so
-- opting out is invisible to everyone else -- the aggregator (service role) is
-- the only reader across rows, and it stores only counts.
create table private.company_step_challenge_optins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid not null references public.company_step_challenges (id) on delete cascade,
  opted_in boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, challenge_id)
);

grant select, insert, update on private.company_step_challenge_optins to authenticated;

alter table private.company_step_challenge_optins enable row level security;

create policy "read own challenge optin" on private.company_step_challenge_optins
  for select using (auth.uid() = user_id);
create policy "set own challenge optin" on private.company_step_challenge_optins
  for insert with check (auth.uid() = user_id);
create policy "update own challenge optin" on private.company_step_challenge_optins
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---- The team aggregate (public, service-role-written) ----------------------
-- The ONLY window a company has onto steps: one team total + counts per
-- challenge, never an individual and never who opted in. While `suppressed` is
-- true (below the k-anon floor) `total_steps` is stored as 0, so even this row
-- can't reveal a person. Written only by the service-role aggregation job.
create table public.company_step_totals (
  challenge_id uuid primary key references public.company_step_challenges (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  total_steps bigint not null default 0,
  contributor_count integer not null default 0,   -- opted-in members with steps > 0
  opted_in_count integer not null default 0,
  headcount integer not null default 0,           -- company employees, for % opted-in
  target_reached boolean not null default false,
  suppressed boolean not null default false,      -- true while below the k-anon floor
  updated_at timestamptz not null default now()
);

alter table public.company_step_totals enable row level security;

-- HR admins read the aggregate for their own company only.
create policy "hr admins read their own company step totals"
  on public.company_step_totals for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'hr_admin'
      and p.company_id = company_step_totals.company_id
  ));

-- Employees read their OWN company's team total (the staff progress bar). Same
-- aggregate-only exposure -- no individual is derivable.
create policy "employees read their own company step totals"
  on public.company_step_totals for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.company_id = company_step_totals.company_id
  ));

-- No insert/update/delete policy for authenticated on company_step_totals: only
-- service_role (which bypasses RLS) writes it, from the aggregation job.
