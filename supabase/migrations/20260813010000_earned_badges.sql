-- ============================================================================
-- GAMIFICATION (Track 2 · D2, part 2): persist earned badges.
-- ============================================================================
-- Badges have been DERIVED on every load (src/lib/gamification/badges.ts) from
-- monotonic engagement counts -- correct, but with no memory of WHEN a badge was
-- earned and no durability if a threshold is ever re-tuned. This records each
-- badge the first time it's earned, so:
--   * earned_at is captured (a "new badge" moment, a dated history), and
--   * an already-earned badge is kept even if its threshold later changes
--     ("earned, never lost" -- see badges.ts).
--
-- Own-rows-only, like every personal record: a member only ever sees their own
-- badges. No policy references hr_admin/ntitt_admin, and nothing aggregates it.
-- (A future opt-in leaderboard is a separate, deliberately-scoped exposure.)

create table private.earned_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  badge_key text not null,
  earned_at timestamptz not null default now(),
  unique (user_id, badge_key)
);

grant select, insert on private.earned_badges to authenticated;

alter table private.earned_badges enable row level security;

-- Insert-and-read only: a badge, once earned, is never revoked or edited by the
-- member (no update/delete policy). auth.uid() = user_id on both read and write.
create policy "read own earned badges" on private.earned_badges
  for select using (auth.uid() = user_id);
create policy "earn own badges only" on private.earned_badges
  for insert with check (auth.uid() = user_id);
