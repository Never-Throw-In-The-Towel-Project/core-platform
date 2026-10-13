-- ============================================================================
-- C1: tenant-lock support-request inserts to the caller's own company.
-- ============================================================================
-- private.support_requests had a single FOR ALL policy whose WITH CHECK was only
-- `auth.uid() = user_id` -- it never constrained company_id (init_schema
-- 20260730000000). Because the `private` schema is exposed over PostgREST
-- (config.toml), an authenticated member of company A could POST directly to
-- /rest/v1/support_requests (Content-Profile: private) with company_id = B,
-- bypassing the server action (which derives company_id safely). That row:
--   1. bumps company B's support KPI -- the increment_support_count trigger
--      (SECURITY DEFINER) upserts public.company_support_counts using the row's
--      own new.company_id verbatim; and
--   2. 15 minutes later pages company B's real first-aider -- the
--      monitor-support-response-time cron looks the company up by the row's
--      company_id and SMS/emails its support_contact, carrying the
--      attacker-supplied contact_display_name / contact_method text.
-- This is finding C1 (cross-tenant escalation + KPI corruption).
--
-- Fix: the INSERT/UPDATE check now also requires company_id to be the caller's
-- OWN company. The subquery reads only the caller's own profiles row, which the
-- profiles self-read policy already allows, so no SECURITY DEFINER is needed;
-- profiles.company_id is NOT NULL, so the check is a total function (and
-- fails closed -- blocking the insert -- for the impossible no-profile case).
-- The only INSERT in the app (lib/actions/support.ts) already sets company_id to
-- the caller's own profile.company_id, so it still passes; every other writer is
-- a service-role job that bypasses RLS entirely. SELECT/UPDATE/DELETE visibility
-- is unchanged (still own rows via user_id).

drop policy if exists "own support requests only" on private.support_requests;
create policy "own support requests only" on private.support_requests
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and company_id = (select company_id from public.profiles where id = auth.uid())
  );

-- Bound the free-text fields at the DB layer too, so the raw REST path can't
-- exceed the server action's own Zod limits (contact_display_name <= 100,
-- contact_method <= 200) and spam a first-aider's SMS/email with a huge body.
-- Existing rows were all written through the action, so they already comply.
alter table private.support_requests
  add constraint support_requests_contact_display_name_len
    check (contact_display_name is null or char_length(contact_display_name) <= 100),
  add constraint support_requests_contact_method_len
    check (contact_method is null or char_length(contact_method) <= 200);
