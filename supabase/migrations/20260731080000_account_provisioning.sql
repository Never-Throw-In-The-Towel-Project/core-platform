-- ============================================================================
-- ACCOUNT PROVISIONING: creates a public.profiles row automatically when a
-- new auth.users row is created via an admin invite
-- (supabase.auth.admin.inviteUserByEmail -- see src/lib/actions/invite.ts),
-- reading company_id/role/display_name out of the invite's user_metadata.
-- ============================================================================
-- Closes a gap found in a full-platform audit: nothing in the codebase ever
-- created a profiles row before this. enable_signup is deliberately false
-- (see supabase/config.toml) -- employees/HR admins are provisioned by a
-- company-admin flow, not open self-signup -- but until now there was no
-- such flow in the code at all, only a manual Studio insert per person.
--
-- The real path now is: an hr_admin/ntitt_admin invites someone (see
-- src/lib/actions/invite.ts) -> the admin API creates the auth.users row
-- immediately, before the invite is ever accepted -> this trigger fires
-- right then -> the profiles row already exists by the time the person
-- clicks the invite email. Accepting the invite just establishes their
-- session, through the same /auth/callback PKCE code-exchange route every
-- magic-link sign-in already uses -- no new callback handling needed.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, company_id, role, display_name)
  values (
    new.id,
    (new.raw_user_meta_data ->> 'company_id')::uuid,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'employee'),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- SECURITY DEFINER is required: this runs as part of the system's own
-- insert into auth.users (triggered by the admin invite API), not inside
-- the new user's own authenticated request -- auth.uid() isn't the new
-- user yet at this point, so the ordinary "users insert their own profile"
-- RLS policy (auth.uid() = id) could never be satisfied here regardless.
-- This trigger is the one deliberate, narrow bypass of that policy, and it
-- only ever inserts a row keyed to the triggering auth.users row's own id.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Note for anyone provisioning a user by hand in Studio instead of through
-- the app's invite flow (e.g. a one-off internal account): company_id is
-- NOT NULL on profiles, so raw_user_meta_data must include a "company_id"
-- key (a valid companies.id) or this trigger's insert -- and therefore the
-- whole auth.users insert -- fails and rolls back. That's intentional: a
-- signed-up user with no profile is exactly the silent-redirect-to-login
-- dead end this migration exists to close off, so failing loudly here is
-- safer than succeeding into a broken account.
