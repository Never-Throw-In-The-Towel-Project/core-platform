-- ============================================================================
-- PHASE 9 (4/4) — Web Push notifications, the last piece of the "installable,
-- push-capable" PWA promise manifest.ts has claimed since Phase 1.
-- profiles.morning_notification_time/night_notification_time/
-- sunday_notification_time have existed since Phase 1 with nothing reading
-- them; this migration is what finally makes them mean something.
--
-- Same schema placement reasoning as `profiles` itself: a push subscription
-- (endpoint + keys) is a device/browser identifier tied to account settings,
-- not journal-style content, so it lives in `public` with a self-managed RLS
-- policy, not `private`.
-- ============================================================================

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "users manage their own push subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Dedup log for the dispatch cron: without this, a cron running every 15
-- minutes has no way to know a user's morning notification already went out
-- today vs. is still due. One row per (user, notification type, local date)
-- actually sent; the cron inserts here right before sending and skips
-- anyone who already has today's row -- service-role only, no user ever
-- reads or writes this directly.
create table public.push_notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  notification_type text not null check (notification_type in ('morning', 'night', 'sunday')),
  sent_date date not null,
  sent_at timestamptz not null default now(),
  unique (user_id, notification_type, sent_date)
);

-- No policies -- service_role (the dispatch cron) bypasses RLS entirely, so
-- this needs none; RLS enabled with zero policies means zero access for
-- every other role, same convention as the aggregate tables above.
alter table public.push_notification_log enable row level security;
