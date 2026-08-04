-- ============================================================================
-- Phase 3 onboarding: a first-run flow (privacy statement, then notification
-- times + display name) gated in src/app/(app)/layout.tsx. This flag is the
-- entire gate -- false until the flow's last step writes true, same
-- accept-once shape as profiles.community_opt_in.
-- ============================================================================
alter table public.profiles
  add column onboarding_completed boolean not null default false;
