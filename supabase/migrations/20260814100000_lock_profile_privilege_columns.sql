-- ============================================================================
-- SECURITY (CRITICAL): stop the session (authenticated) client from rewriting
-- a user's own role / company_id -- a direct self-escalation to ntitt_admin.
-- ============================================================================
-- profiles' UPDATE policy is `using (auth.uid() = id)` with NO `with check`
-- (20260730000000_init_schema.sql). When `with check` is omitted Postgres
-- reuses the USING expression as the check, which constrains only the row's
-- `id` -- NOT the new `role` or `company_id`. Supabase grants `authenticated`
-- table-wide UPDATE by default with RLS as the only gate, so any logged-in
-- user, using the public anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY, in every
-- browser) in their own console, could run:
--
--     supabase.from('profiles').update({ role: 'ntitt_admin' }).eq('id', myId)
--
-- and self-mint a platform admin -- clearing requireNtittAdmin(), the
-- community/content "ntitt admins read all" RLS policies, and
-- inviteStaffMember-into-any-company-at-any-role -- or set `company_id` to
-- plant themselves inside any tenant. This is the same privilege-escalation
-- class the handle_new_user hardening (20260810000000) closed for the *signup
-- metadata* vector; that fix left this direct-UPDATE vector open, which made
-- all the careful server-side role/company derivation in invite.ts / signup.ts
-- / provision.ts / companyAdmin.ts moot.
--
-- Fix: column-level UPDATE, mirroring the companies column-grant in
-- 20260810020000_restrict_company_contact_columns.sql. Revoke the default
-- table-wide UPDATE and re-grant UPDATE on only the self-service columns the
-- app writes through the session client (verified: settings.ts, onboarding.ts,
-- community.ts). `role`, `company_id`, `id` and `created_at` are deliberately
-- excluded, so they can only ever be written by the service-role client
-- (invite.ts / signup.ts / companyAdmin.ts), which BYPASSES column grants --
-- exactly the roles that are allowed to set them after server-side validation.
-- The RLS row policy (`auth.uid() = id`) is unchanged; this narrows *which
-- columns*, not *which rows*. `anon` gets no UPDATE at all (it never legitimately
-- writes a profile).
revoke update on public.profiles from anon, authenticated;

grant update (
  display_name,
  community_opt_in,
  podcast_guest_opt_in,
  podcast_guest_anonymity_preference,
  podcast_guest_consented_at,
  morning_notification_time,
  night_notification_time,
  sunday_notification_time,
  timezone,
  onboarding_completed
) on public.profiles to authenticated;
