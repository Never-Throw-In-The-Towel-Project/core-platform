-- ============================================================================
-- PHASE 2 — DAILY CORE LOOP: rotating shared content for Workout Wednesday
-- and Thoughts on Thursday.
-- ============================================================================
-- Everything else Phase 2 needs (morning_entries, night_entries,
-- themed_checkins, sunday_setups) already exists from Phase 1. This
-- migration only adds the two pieces of shared, rotating content the brief
-- calls for that Phase 1 didn't cover:
--
--   - Workout Wednesday's "workout of the week" (5 exercises x 4 tiers,
--     rotating). Resolved as a "week-journey": every user sees the same
--     workout in the same real calendar week, keyed by ISO week number
--     modulo however many weeks are seeded (see src/lib/routines/workouts.ts
--     for the resolution logic) -- not tied to when a given user started.
--   - Thoughts on Thursday's rotating quote bank, same resolution pattern.
--
-- Both are shared/public content (no user data), following the same
-- "authenticated users read, only service_role/admin tooling writes" pattern
-- as content_videos and podcast_episodes in the Phase 1 migration.
-- ============================================================================

create table public.workout_weeks (
  id uuid primary key default gen_random_uuid(),
  -- Position in the rotating bank, 1-based. Which real calendar week maps to
  -- which workout_weeks row is resolved in application code (ISO week number
  -- modulo count of rows), not stored here -- keeps adding a new week to the
  -- rotation a pure data insert, no recalculation of existing rows.
  bank_position integer not null unique,
  created_at timestamptz not null default now()
);

alter table public.workout_weeks enable row level security;
create policy "authenticated users read workout weeks"
  on public.workout_weeks for select
  using (auth.role() = 'authenticated');

create table public.workout_week_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_week_id uuid not null references public.workout_weeks (id) on delete cascade,
  exercise_order smallint not null check (exercise_order between 1 and 5),
  exercise_name text not null,
  -- One demo video per tier. Nullable: a tier's demo video can be filled in
  -- after the exercise/week row exists, without blocking content ops on
  -- having all four ready at once.
  beginner_video_id uuid references public.content_videos (id),
  intermediate_video_id uuid references public.content_videos (id),
  advanced_video_id uuid references public.content_videos (id),
  elite_video_id uuid references public.content_videos (id),
  created_at timestamptz not null default now(),
  unique (workout_week_id, exercise_order)
);

alter table public.workout_week_exercises enable row level security;
create policy "authenticated users read workout week exercises"
  on public.workout_week_exercises for select
  using (auth.role() = 'authenticated');

create table public.daily_quotes (
  id uuid primary key default gen_random_uuid(),
  bank_position integer not null unique,
  quote_text text not null,
  author text,
  created_at timestamptz not null default now()
);

alter table public.daily_quotes enable row level security;
create policy "authenticated users read daily quotes"
  on public.daily_quotes for select
  using (auth.role() = 'authenticated');
