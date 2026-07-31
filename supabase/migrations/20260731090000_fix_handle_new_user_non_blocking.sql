-- ============================================================================
-- FIX: handle_new_user must never abort account creation.
-- ============================================================================
-- Found testing the first real invite end-to-end: Supabase's invite API
-- does not reliably attach user_metadata to the same auth.users insert this
-- trigger fires on -- confirmed via Postgres logs: "null value in column
-- company_id ... violates not-null constraint" (23502), even though the
-- invite request explicitly included company_id in its metadata. Because
-- the previous version of this trigger raised on a missing company_id, that
-- error rolled back the ENTIRE auth.users insert -- so every invite failed
-- outright, not just ended up with a missing profile.
--
-- Fix: this trigger now only inserts when it actually has a usable
-- company_id -- it becomes a no-op (not a rollback) if the metadata isn't
-- there yet. src/lib/actions/invite.ts is the real, reliable mechanism now:
-- it upserts the profiles row directly, using the values it already
-- validated, immediately after a successful inviteUserByEmail call, rather
-- than depending on this trigger at all for the admin-invite path. This
-- trigger remains only as a defensive fallback for any other path that
-- might someday create a user with metadata attached at insert time.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_company_id uuid;
begin
  meta_company_id := (new.raw_user_meta_data ->> 'company_id')::uuid;
  if meta_company_id is null then
    return new;
  end if;

  insert into public.profiles (id, company_id, role, display_name)
  values (
    new.id,
    meta_company_id,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'employee'),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
