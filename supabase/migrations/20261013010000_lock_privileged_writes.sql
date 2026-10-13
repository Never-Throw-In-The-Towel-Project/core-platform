-- ============================================================================
-- Lock down over-granted writes: profiles INSERT (C3) + badge self-award (C2).
-- ============================================================================
-- Both the `public` and `private` schemas are REST-exposed, so a table-level
-- grant to `authenticated` is directly reachable over PostgREST regardless of
-- what the app's server actions do.

-- ---- C3: remove the member INSERT grant on public.profiles -----------------
-- The profiles INSERT policy only constrains `id` (= auth.uid()), not role or
-- company_id, so a member could POST a profiles row with an arbitrary role /
-- company_id. No legitimate member INSERT exists: handle_new_user is SECURITY
-- DEFINER, and signup/invite write via the service-role admin client. The
-- self-service column UPDATE grant (onboarding/settings) is untouched.
revoke insert on public.profiles from anon, authenticated;

-- ---- C2 (part 1): badges are awarded service-role-side only ----------------
-- earned_badges.badge_key was unconstrained and INSERT was granted to members
-- (own-rows RLS only), so a member could POST `{user_id: self, badge_key:
-- 'team_mvp'}` and then surface it on the wins board. All three legitimate
-- award paths now run server-side: the step-challenge job already uses the
-- service-role client, and syncEarnedBadgesAction / awardHabitCompleteIfReached
-- are moved onto it in this change -- each derives eligibility from the member's
-- own data server-side, so revoking the direct member INSERT breaks nothing.
revoke insert on private.earned_badges from authenticated;

-- ---- C2 (part 2): a shared badge must actually be earned --------------------
-- community_posts.shared_badge_key is unconstrained by RLS, and community_posts
-- is member-writable, so a member can POST a wins row directly (bypassing
-- shareBadgeAction's ownership check) with any badge key. A cross-schema FK/CHECK
-- into the per-user private table isn't possible, so enforce it with a trigger:
-- a non-null shared_badge_key must match a badge the AUTHOR genuinely earned.
-- SECURITY DEFINER so it can read private.earned_badges (own-rows-only under RLS
-- otherwise); empty search_path with fully-qualified names per the safe pattern.
create or replace function public.enforce_shared_badge_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.shared_badge_key is not null
     and not exists (
       select 1 from private.earned_badges eb
       where eb.user_id = new.user_id
         and eb.badge_key = new.shared_badge_key
     ) then
    raise exception 'shared_badge_key % is not an earned badge for this author', new.shared_badge_key
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function public.enforce_shared_badge_ownership() is
  'Finding C2: a community_posts row may only carry a shared_badge_key the author earned (private.earned_badges). Enforced here because shareBadgeAction is bypassable via a direct PostgREST insert.';

drop trigger if exists trg_enforce_shared_badge_ownership on public.community_posts;
create trigger trg_enforce_shared_badge_ownership
  before insert or update of shared_badge_key on public.community_posts
  for each row execute function public.enforce_shared_badge_ownership();
