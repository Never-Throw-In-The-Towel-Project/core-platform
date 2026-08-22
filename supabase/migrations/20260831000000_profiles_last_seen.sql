-- ============================================================================
-- profiles.last_seen_at — a coarse activity marker powering the Admin Overview
-- "active users" metric (daily/weekly/monthly-active).
-- ============================================================================
-- last_seen_at is a low-resolution "this member opened the app" timestamp,
-- updated at most once an hour. It is NOT behavioural or health data — it says
-- nothing about what a member did, only that they were present — so it lives on
-- the public `profiles` row (identity), never in the `private` schema. It is a
-- platform-operations signal for the super admin, consistent with the privacy
-- model: no routine/check-in/review content is involved.
--
-- Deliberately NOT added to the authenticated column-UPDATE grant
-- (20260814100000_lock_profile_privilege_columns.sql): a member must not be able
-- to hand-write their own activity timestamp (spoofing the metric), and the app
-- never writes it through the session client. The ONLY writer is
-- touch_last_seen() below.

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

comment on column public.profiles.last_seen_at is
  'Coarse last-activity timestamp, updated at most hourly via touch_last_seen(). Powers the admin active-users metric. Not behavioural/health data; never written directly by the session client.';

-- Throttled, self-only activity stamp. SECURITY DEFINER so it can write a column
-- the session client is (intentionally) not granted UPDATE on. The WHERE clause
-- pins the write to the CALLER's own row (id = auth.uid()) and to at-most-hourly
-- updates, so it can neither touch another user's row nor be used to plant an
-- arbitrary timestamp. search_path is pinned per SECURITY DEFINER best practice.
create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set last_seen_at = now()
   where id = auth.uid()
     and (last_seen_at is null or last_seen_at < now() - interval '1 hour');
$$;

revoke all on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;
