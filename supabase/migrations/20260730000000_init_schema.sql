-- ============================================================================
-- NTITT PLATFORM — INITIAL SCHEMA
-- ============================================================================
-- This migration is the foundation the brief explicitly demands be built
-- first: "Every piece of data a user enters into their personal check-ins,
-- routines, and reviews is PRIVATE TO THAT USER ONLY. The company dashboard
-- shows aggregate anonymised data only." That rule is enforced here at two
-- independent layers, not just in application code:
--
--   1. ROW LEVEL SECURITY (the real, hard boundary) — every table in
--      `private` has RLS enforcing `auth.uid() = user_id`. This is enforced
--      by Postgres itself on every query, regardless of what application
--      code does or gets wrong. There is no table, view, or policy anywhere
--      that lets an HR admin query another user's row, because no policy
--      grants it — not "policy denies it", the grant simply does not exist.
--      (Earlier drafts of this migration also excluded `private` from
--      Supabase's exposed API schemas as a supposed second barrier — tested
--      locally and reverted: our own Next.js server code reaches Postgres
--      through the same PostgREST/`authenticated`-role path as any other
--      client via @supabase/ssr, so hiding the schema from the API blocks
--      our own reads and writes too, not just outside access. RLS is the
--      mechanism that has to do the real work, so it needs to be reachable.)
--
--   2. ONE-WAY AGGREGATION — the `public` schema (which the HR dashboard
--      reads) never contains a foreign key or join back into `private`. It
--      only contains pre-computed counts/percentages, written exclusively by
--      SECURITY DEFINER functions running as `service_role` (our server-side
--      aggregation job / trigger), never by client code.
--
-- The `private` Postgres schema (as opposed to just more tables in `public`)
-- is still kept as a matter of organizational clarity and blast-radius
-- reduction — anyone touching this codebase sees at a glance which tables
-- hold personal journal content — but it is not, by itself, an access
-- control mechanism. RLS is.
--
-- Sleep score (morning) and day rating (night) are the two fields the brief
-- singles out by name as never-reportable. They live in `private` like
-- everything else here, but are called out in comments below as a reminder:
-- do not ever add a column, view, or aggregate that surfaces their values,
-- even in bucketed/averaged form.
-- ============================================================================

create schema if not exists private;

-- `anon` never gets access to `private` — every table in this schema
-- requires an authenticated session. `authenticated` gets schema usage and
-- table-level grants; RLS policies (below, per table) then restrict that
-- down to "your own rows only". `service_role` (the aggregation job) always
-- bypasses RLS by Supabase's design, which is exactly what it needs to do
-- to compute cross-user rollups.
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
alter default privileges in schema private grant all on tables to service_role;
alter default privileges in schema private grant select, insert, update on tables to authenticated;

create extension if not exists "pgcrypto";


-- ============================================================================
-- ENUMS
-- ============================================================================

create type public.user_role as enum ('employee', 'hr_admin');
create type public.weekday_theme as enum ('monday', 'tuesday', 'wednesday', 'thursday', 'friday');
create type public.review_type as enum ('30_day', '90_day');
create type public.support_urgency as enum ('check_in', 'talk_today', 'urgent');
create type public.support_status as enum ('new', 'contacted', 'resolved');
create type public.video_category as enum ('mental_fitness', 'physical_fitness', 'tools_tips');
create type public.workout_tier as enum ('beginner', 'intermediate', 'advanced', 'elite');


-- ============================================================================
-- PUBLIC SCHEMA — tenants, identity, shared content, aggregates only
-- ============================================================================

-- One row per client company (KP Snacks, Amazon, ...). Branding columns back
-- the co-branded subdomain experience (see docs/ARCHITECTURE.md) — presentation
-- only, every company shares the same underlying check-in framework/content.
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,              -- subdomain: {slug}.ntitt.co.uk
  custom_domain text unique,              -- optional CNAME for flagship clients
  logo_url text,
  primary_color text,                     -- hex, applied as a CSS var
  accent_color text,
  welcome_copy text,
  support_contact_name text,              -- who "Ask for Support" alerts route to
  support_contact_phone text,
  support_contact_email text,
  created_at timestamptz not null default now()
);

alter table public.companies enable row level security;

-- Company branding/name/slug must be readable pre-authentication (the proxy
-- resolves a subdomain to a company to render the right logo/colors on the
-- login page). Nothing sensitive lives on this table.
create policy "companies are publicly readable"
  on public.companies for select
  using (true);


-- One row per authenticated user. NOTE: no journal content, scores, or
-- answers ever go here — profile/identity data only.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id),
  role public.user_role not null default 'employee',
  display_name text not null,             -- community-facing; does not have to be real name
  community_opt_in boolean not null default false,
  podcast_guest_opt_in boolean not null default false,
  morning_notification_time time default '07:00',
  night_notification_time time default '21:00',
  sunday_notification_time time,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users manage their own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "users update their own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "users insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Deliberately no policy grants an hr_admin row-level access to other
-- profiles. The HR dashboard is served entirely from the aggregate tables
-- below, looked up by the admin's own company_id from their own profile row.


-- Shared content library — built once, available to every company.
create table public.content_videos (
  id uuid primary key default gen_random_uuid(),
  vimeo_id text not null,
  title text not null,
  category public.video_category not null,
  tags text[] not null default '{}',
  workout_tier public.workout_tier,          -- only set for physical_fitness/Workout Wednesday demos
  duration_seconds integer,
  created_at timestamptz not null default now()
);

alter table public.content_videos enable row level security;
create policy "authenticated users read content"
  on public.content_videos for select
  using (auth.role() = 'authenticated');

create table public.podcast_episodes (
  id uuid primary key default gen_random_uuid(),
  episode_number integer not null unique,
  title text not null,
  release_date date not null,
  embed_url text not null,
  guest_display_name text,
  created_at timestamptz not null default now()
);

alter table public.podcast_episodes enable row level security;
create policy "authenticated users read podcast episodes"
  on public.podcast_episodes for select
  using (auth.role() = 'authenticated');


-- ---- Aggregate tables the HR dashboard reads. Written only by service_role. ----

create table public.company_support_counts (
  company_id uuid primary key references public.companies (id),
  total_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.company_daily_participation (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  entry_date date not null,
  weekday public.weekday_theme,          -- null for morning/night, set for themed check-ins
  segment text not null,                 -- 'morning' | 'night' | 'themed_checkin'
  completed_count integer not null default 0,
  eligible_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (company_id, entry_date, segment)
);

create table public.company_review_completions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  review_type public.review_type not null,
  period_start date not null,
  completed_count integer not null default 0,
  eligible_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (company_id, review_type, period_start)
);

alter table public.company_support_counts enable row level security;
alter table public.company_daily_participation enable row level security;
alter table public.company_review_completions enable row level security;

-- HR admins may read aggregate rows for their own company only. No insert/
-- update/delete policy exists for authenticated users on any of these three
-- tables — only service_role (which bypasses RLS) can write them, from the
-- aggregation job or the support-count trigger below.
create policy "hr admins read their own company support counts"
  on public.company_support_counts for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'hr_admin'
        and p.company_id = company_support_counts.company_id
    )
  );

create policy "hr admins read their own company participation"
  on public.company_daily_participation for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'hr_admin'
        and p.company_id = company_daily_participation.company_id
    )
  );

create policy "hr admins read their own company review completions"
  on public.company_review_completions for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'hr_admin'
        and p.company_id = company_review_completions.company_id
    )
  );


-- ============================================================================
-- PRIVATE SCHEMA — every personal check-in, routine, and review.
-- Not exposed via the API (see supabase/config.toml). RLS is defense in depth
-- on top of that, restricting every table to `auth.uid() = user_id`.
-- ============================================================================

create table private.morning_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  sleep_score smallint check (sleep_score between 1 and 10),  -- NEVER reportable. See file header.
  morning_walk boolean not null default false,
  breathwork boolean not null default false,
  cold_dip boolean not null default false,
  power_list text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create table private.night_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  no_phone_before_bed boolean not null default false,
  hot_bath_or_shower boolean not null default false,
  gratitude text,
  highlight text,
  day_rating smallint check (day_rating between 1 and 10),   -- NEVER reportable. See file header.
  looking_ahead text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

-- Momentum Monday through Feel Good Friday. Answers are stored as jsonb
-- keyed by prompt rather than one column per question: the brief is explicit
-- that these prompts are fixed and shared across every company, but wording
-- may still evolve, and jsonb avoids a schema migration every time it does.
-- Monday's `goals` are read back on Friday via (user_id, week_start_date) —
-- no separate linking table needed.
create table private.themed_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start_date date not null,          -- the Monday of that week
  weekday public.weekday_theme not null,
  goals jsonb,                            -- Monday only: this week's 3 goals
  answers jsonb not null default '{}',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, week_start_date, weekday)
);

create table private.sunday_setups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start_date date not null,          -- the following Monday
  prep_notes text,
  intention text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, week_start_date)
);

create table private.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start_date date not null,
  habits_served_well text,
  challenges_helped_grow text,
  lessons_learned text,
  challenges_overcome text,
  feels_better_from_habits text,
  one_thing_to_improve text,
  habits_to_double_down text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, week_start_date)
);

-- 30-day and 90-day reviews share a shape; `extra` holds the fields the
-- brief adds only for the 90-day version (top 10 wins, 3-month habit
-- summary, comparison to the 30-day self-assessment, etc.) so one table
-- serves both without a sparse column set.
create table private.periodic_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  review_type public.review_type not null,
  period_start date not null,
  period_end date not null,
  most_proud_of text,
  most_consistent_habits text,
  challenges_faced text,
  whats_working text,
  needs_to_change text,
  top_wins jsonb not null default '[]',
  self_assessment jsonb,     -- {mindset, energy, discipline, relationships, confidence, overall}
  focus_next_period text,
  commitment_signed_name text,
  commitment_signed_date date,
  extra jsonb not null default '{}',
  pdf_generated_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, review_type, period_start)
);

-- "Ask for Support" submissions. Person-led only — nothing else in the
-- platform is allowed to write a row here. `company_id` is denormalized so
-- the count trigger below doesn't need a join back through `private` at
-- write time from a context that might not have it.
create table private.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,  -- nullable: user may choose anonymous
  company_id uuid not null references public.companies (id),
  contact_display_name text,              -- what the responder sees; may be "Anonymous"
  urgency public.support_urgency not null,
  contact_method text,
  status public.support_status not null default 'new',
  delivery_status jsonb not null default '{}',  -- sms/email dispatch + delivery tracking, see lib/support/alert.ts
  created_at timestamptz not null default now(),
  contacted_at timestamptz,
  resolved_at timestamptz
);

-- `alter default privileges` (set earlier in this file) only applies to
-- tables created *after* it ran in a fresh session -- within this same
-- migration transaction the tables above already exist, so grant explicitly.
grant select, insert, update on
  private.morning_entries,
  private.night_entries,
  private.themed_checkins,
  private.sunday_setups,
  private.weekly_reviews,
  private.periodic_reviews,
  private.support_requests
to authenticated;

alter table private.morning_entries enable row level security;
alter table private.night_entries enable row level security;
alter table private.themed_checkins enable row level security;
alter table private.sunday_setups enable row level security;
alter table private.weekly_reviews enable row level security;
alter table private.periodic_reviews enable row level security;
alter table private.support_requests enable row level security;

create policy "own morning entries only" on private.morning_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own night entries only" on private.night_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own themed checkins only" on private.themed_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own sunday setups only" on private.sunday_setups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own weekly reviews only" on private.weekly_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own periodic reviews only" on private.periodic_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own support requests only" on private.support_requests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- No policy on any private table ever references role = 'hr_admin'. That is
-- intentional, not an oversight — do not add one.


-- ============================================================================
-- AGGREGATION: private -> public, one-way, service_role only
-- ============================================================================

-- Support-button submissions increment a live company-wide counter. This
-- runs as SECURITY DEFINER so the app can insert a support request under the
-- user's own RLS-scoped session while the counter update — which touches a
-- public-schema row the user has no direct write policy for — still
-- succeeds. It only ever writes a total; it cannot read back anything from
-- private.support_requests beyond the row that just triggered it.
create or replace function private.increment_support_count()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into public.company_support_counts (company_id, total_count, updated_at)
  values (new.company_id, 1, now())
  on conflict (company_id)
  do update set total_count = public.company_support_counts.total_count + 1,
                updated_at = now();
  return new;
end;
$$;

create trigger trg_increment_support_count
  after insert on private.support_requests
  for each row execute function private.increment_support_count();

-- Participation and review-completion aggregates (percent of staff who
-- checked in, most/least engaged day, 30/90-day completion rates) are
-- lower-frequency, cross-user rollups rather than single-row triggers.
-- They are computed by a scheduled job running as service_role — see
-- docs/ARCHITECTURE.md for the job design. That job calls plain
-- insert/upsert statements against the public aggregate tables directly
-- (service_role bypasses RLS), so no additional SQL function is required
-- here; this comment documents the intended write path so it isn't
-- mistaken for a gap.
