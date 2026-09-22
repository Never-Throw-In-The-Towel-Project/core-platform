-- ============================================================================
-- Community anonymity, part 1: stop anonymous (unauthenticated) reads.
-- ============================================================================
-- The SELECT policies on community_posts / community_comments (phase-7 migration
-- 20260731030000, L49-60 / L114-125) had no role clause and an unguarded
-- `scope = 'global'` branch. Supabase grants the `anon` role SELECT on public
-- tables by default and nothing here revoked it -- so a request carrying the
-- public anon key and NO session could read every global feed + wins post and
-- comment (body, user_id, identity_override, image_url, shared_badge_key). The
-- product promises "never your real name"; this was the boundary behind it.
--
-- This closes the anonymous read path two ways (defense in depth):
--   1. Recreate both "read visible" SELECT policies restricted to the
--      `authenticated` role, with an explicit `auth.uid() is not null` guard on
--      the previously-unguarded global branch. With RLS enabled and no
--      permissive SELECT policy matching the `anon` role, an anonymous request
--      now reads zero rows regardless of any table grant.
--   2. Revoke the default `anon` SELECT grant on both tables.
--
-- The company/global visibility logic for authenticated members and the
-- ntitt_admin moderation SELECT policies are unchanged (the admin policies
-- already cannot match `anon` -- their subquery needs a non-null auth.uid()).
-- The in-app peer-DTO refactor and anon handles for invited/legacy members
-- (findings A2 / A3), and the public community-images bucket (A4), ride a
-- follow-up -- those are authenticated-member leaks, not the open-internet one
-- this migration closes.

revoke select on public.community_posts from anon;
revoke select on public.community_comments from anon;

drop policy if exists "read visible community posts" on public.community_posts;
create policy "read visible community posts"
  on public.community_posts for select
  to authenticated
  using (
    auth.uid() is not null
    and not is_removed
    and (
      scope = 'global'
      or (
        scope = 'company'
        and company_id = (select p.company_id from public.profiles p where p.id = auth.uid())
      )
    )
  );

drop policy if exists "read visible community comments" on public.community_comments;
create policy "read visible community comments"
  on public.community_comments for select
  to authenticated
  using (
    auth.uid() is not null
    and not is_removed
    and (
      scope = 'global'
      or (
        scope = 'company'
        and company_id = (select p.company_id from public.profiles p where p.id = auth.uid())
      )
    )
  );
