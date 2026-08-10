-- ============================================================================
-- SECURITY (CRITICAL): handle_new_user must never trust client-supplied
-- role or company_id.
-- ============================================================================
-- Privilege-escalation fix found in a full-platform security review.
--
-- enable_signup = true (supabase/config.toml, Phase 11 direct/public
-- signup). That means the GoTrue /signup endpoint is reachable by anyone
-- holding the *public* anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY, exposed to
-- every browser), with a fully client-controlled `data` payload that lands
-- in auth.users.raw_user_meta_data. The previous version of this trigger
-- read BOTH role and company_id straight out of that metadata:
--
--     role:       coalesce((raw_user_meta_data ->> 'role')::user_role, 'employee')
--     company_id: (raw_user_meta_data ->> 'company_id')::uuid
--
-- so a direct call bypassing src/lib/actions/signup.ts --
--     auth.signUp({ email, password, data: { role: 'ntitt_admin',
--                   company_id: '<any companies.id>' } })
-- -- minted a platform-admin (or arbitrary-company hr_admin) profiles row.
-- The attacker controls their own inbox, so email confirmation is no
-- barrier. That is a full compromise of the admin / community-moderation /
-- cross-tenant plane (a self-minted ntitt_admin passes requireNtittAdmin()
-- and the "ntitt admins read all community content" RLS policies, and can
-- inviteStaffMember anyone into any company as any role).
--
-- The private-journal boundary itself held even through this hole -- no
-- private-schema policy references any admin role -- but everything gated on
-- role did not.
--
-- Fix: this trigger now ALWAYS provisions the safe default -- role
-- 'employee', company_id = the shared "NTITT Direct" company -- and reads
-- neither role nor company_id from metadata. This does NOT regress the
-- legitimate privileged paths: both invite flows (inviteEmployee /
-- inviteStaffMember, src/lib/actions/invite.ts) and direct self-signup
-- (src/lib/actions/signup.ts) already upsert the profiles row via the
-- service-role admin client with onConflict:"id" (an ON CONFLICT DO UPDATE)
-- IMMEDIATELY after the auth user is created -- so the real, server-validated
-- role/company overwrites this default for accounts created through those
-- flows. A direct GoTrue signup that skips those server actions now gets a
-- plain employee in NTITT Direct and nothing more -- no worse than using the
-- normal public signup form, which already lets anyone create exactly that.
--
-- display_name is still taken from metadata: it carries no privilege, and
-- the email local-part fallback matches prior behavior. The company_id
-- default references the seeded "NTITT Direct" row
-- (20260807000000_direct_company_seed.sql, DIRECT_COMPANY_ID in
-- src/lib/tenant/constants.ts) -- kept in sync with that literal by hand,
-- same as everywhere else that hardcodes it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, company_id, role, display_name)
  values (
    new.id,
    -- Fixed, server-controlled default -- NEVER new.raw_user_meta_data.
    -- DIRECT_COMPANY_ID; the privileged upsert in invite.ts/signup.ts sets
    -- the real company_id afterward for accounts created through those flows.
    '00000000-0000-0000-0000-000000000001'::uuid,
    -- Never trust a client-supplied role -- this is the whole point of the
    -- fix. Always 'employee'; a privileged role only ever comes from the
    -- service-role upsert in invite.ts, never from signup metadata.
    'employee',
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
