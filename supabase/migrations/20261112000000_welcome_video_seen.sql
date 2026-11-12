-- ============================================================================
-- Welcome "why" video: track whether a member has seen the first-run prompt.
-- ============================================================================
-- A new member lands on /home at the end of signup and is shown a one-time modal
-- with Anthony's "why NTITT exists" video (revisitable afterwards from Settings).
-- This flag is what makes the modal show exactly once: the home page renders it
-- while welcome_video_seen_at is null, and dismissing the modal stamps it.
--
-- New signups only: existing members are backfilled to now() so the prompt never
-- pops for anyone already using the platform — they reach the video via the
-- Settings link instead.

alter table public.profiles add column if not exists welcome_video_seen_at timestamptz;

-- Backfill every existing member as "already seen" so only NEW signups (whose
-- row is created after this, defaulting to null) get the auto-prompt.
update public.profiles set welcome_video_seen_at = now() where welcome_video_seen_at is null;

-- The member stamps this through their OWN session client when they dismiss the
-- modal, so it must be an explicitly self-service-updatable column. profiles has
-- column-level UPDATE grants (20260814100000_lock_profile_privilege_columns): the
-- blanket grant was revoked and only whitelisted columns are member-writable, so
-- a new column needs its own grant or the write silently fails. role / company_id
-- stay excluded — this adds exactly one harmless flag.
grant update (welcome_video_seen_at) on public.profiles to authenticated;
