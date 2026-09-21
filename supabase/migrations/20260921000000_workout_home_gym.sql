-- ============================================================================
-- Workout Wednesday → a library-driven Home / Gym choice.
-- ============================================================================
-- The original Workout Wednesday drew its "workout of the week" from a bespoke,
-- rotating bank -- public.workout_weeks + public.workout_week_exercises (five
-- exercises per week, each with one demo video per difficulty tier). That bank
-- was populated only by content ops via Studio/service_role, and in practice was
-- never seeded, so getWorkoutForWeek() returned null and the check-in showed
-- "This week's workout isn't loaded yet -- check back soon." every week. It was
-- also a parallel content pipeline: it referenced the legacy content_videos
-- table, entirely separate from the real Training library (content_items).
--
-- Anthony's call (see docs/ARCHITECTURE.md "Daily core loop"): retire that bank
-- and drive Workout Wednesday from content that actually exists -- the
-- physical-fitness videos in the library -- with a simple Home vs Gym choice.
-- The four difficulty tiers are dropped from the member-facing flow.
--
-- Two changes here:
--   1. Classify library content as a home or a gym workout, so the two modes
--      have a source. A nullable enum tag on content_items (only meaningful for
--      physical_fitness videos; untagged content simply appears in neither
--      mode). Set from the Super Admin Studio and the CSV importer.
--   2. Drop the unused bespoke bank. It is empty in production (no seed data for
--      it exists anywhere in the repo) and nothing else references these tables,
--      so this discards no member data. daily_quotes -- created in the same
--      Phase-2 migration and still used by Thursday's check-in -- and the legacy
--      content_videos table are deliberately left untouched.

-- 1. Home vs Gym classification ---------------------------------------------
create type public.workout_setting as enum ('home', 'gym');

-- Nullable: content is classified only where it's a home/gym workout. Reuses no
-- existing column; the older content_items.workout_tier (a difficulty tag) is a
-- separate, now-unused concept left in place rather than repurposed.
alter table public.content_items
  add column workout_setting public.workout_setting;

comment on column public.content_items.workout_setting is
  'Home vs gym classification for physical_fitness workout videos, driving the Workout Wednesday check-in. null = not a classified workout.';

-- 2. Retire the never-seeded bespoke workout bank ---------------------------
-- Child first (it FKs workout_weeks and content_videos), then the parent. Their
-- RLS policies drop with the tables.
drop table if exists public.workout_week_exercises;
drop table if exists public.workout_weeks;
