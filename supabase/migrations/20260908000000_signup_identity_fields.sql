-- ============================================================================
-- Signup identity & recorded consent (Phase 1 of the signup enhancement).
--
-- Gathers more at account creation and gives members a real anonymity choice
-- that admins can always see behind:
--   * full_name       -- the member's REAL name (admin-visible identity). The
--                        existing display_name STAYS as the separate PUBLIC
--                        HANDLE, shown to other members only when they appear
--                        anonymously -- so a member can post anonymously without
--                        the platform ever losing who they actually are.
--   * date_of_birth   -- collected at signup. No age gate (product decision);
--                        the Terms' "16 or over" line is left for solicitor
--                        review and is deliberately NOT enforced here.
--   * community_identity_preference -- how a member appears TO OTHER MEMBERS by
--                        default: full_name | first_name_only | anonymous. Same
--                        three levels the podcast consent already uses. Admins
--                        ignore it entirely and always see full_name.
--   * tc_agreed_at / tc_version -- durable proof-of-consent for the Terms &
--                        Privacy tick, which until now was GATED at signup but
--                        never recorded. Mirrors podcast_guest_consented_at.
--
-- Plus a per-post override on community_posts, so "post anonymously" stays
-- available for a single post regardless of the account default.
--
-- Nullability: full_name / date_of_birth / tc_* are nullable on purpose. The
-- hardened handle_new_user trigger inserts a profiles row (id, company_id, role,
-- display_name) the instant the auth user is created -- BEFORE signup.ts's
-- service-role upsert fills these in -- so a NOT NULL without a default would
-- break every signup. community_identity_preference is NOT NULL with a
-- 'full_name' default, which is valid for that trigger insert and for every
-- pre-existing row. Existing members are backfilled (full_name := display_name,
-- the only name on file) and re-prompted for a real name in a later phase.
-- Additive; no destructive change, no table added.
-- ============================================================================

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists date_of_birth date,
  add column if not exists community_identity_preference text not null default 'full_name'
    check (community_identity_preference in ('full_name', 'first_name_only', 'anonymous')),
  add column if not exists tc_agreed_at timestamptz,
  add column if not exists tc_version text;

comment on column public.profiles.full_name is
  'Member''s real name -- the admin-visible identity. display_name is the separate public handle, shown to other members only when they appear anonymously.';
comment on column public.profiles.community_identity_preference is
  'Default identity shown to OTHER members (admins always see full_name): full_name | first_name_only | anonymous.';
comment on column public.profiles.tc_agreed_at is
  'When the member agreed to the Terms & Privacy at signup -- durable proof-of-consent. Service-role write only.';

-- Backfill full_name for existing members from their current display_name (the
-- only name on file for them). They can correct it -- and set a distinct public
-- handle -- when re-prompted; new signups collect a real full name directly.
update public.profiles set full_name = display_name where full_name is null;

-- Per-post identity override: null = use the member's account default; otherwise
-- the same three levels, applied to just this post.
alter table public.community_posts
  add column if not exists identity_override text
    check (identity_override is null or identity_override in ('full_name', 'first_name_only', 'anonymous'));

-- Extend the per-column self-service UPDATE grant (the profiles privilege lock,
-- 20260814100000_lock_profile_privilege_columns) so a member can edit these
-- through their own session client. full_name, date_of_birth and the identity
-- preference are self-service. The consent columns (tc_agreed_at / tc_version)
-- are deliberately NOT granted: a proof-of-consent record the user can rewrite
-- isn't proof, so only the service-role client (signup.ts) ever writes them --
-- the same reasoning that keeps role / company_id off this grant.
grant update (full_name, date_of_birth, community_identity_preference)
  on public.profiles to authenticated;
