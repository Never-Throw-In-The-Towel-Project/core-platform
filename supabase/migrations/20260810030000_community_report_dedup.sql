-- ============================================================================
-- Dedup community reports: one report per (post, reporter).
-- ============================================================================
-- Found in the full-platform correctness review. community_reports had no
-- uniqueness guard, and reportCommunityPost (src/lib/actions/community.ts)
-- did no existing-report check -- so tapping "Report" repeatedly on one post
-- (or re-reporting a post that was already reviewed) inserted a fresh row
-- each time, flooding the ntitt_admin moderation queue with duplicates for
-- the same post. community_likes already has this guarantee
-- (unique (post_id, user_id)); reports were the gap.
--
-- Defensive dedup first so the constraint can be added even if duplicates
-- already accumulated (keep the earliest id per pair); then the constraint.
-- The report action now treats the resulting unique violation (SQLSTATE
-- 23505) as an idempotent no-op success rather than an error.
delete from public.community_reports a
using public.community_reports b
where a.post_id = b.post_id
  and a.reporter_user_id = b.reporter_user_id
  and a.id > b.id;

alter table public.community_reports
  add constraint community_reports_post_reporter_unique
  unique (post_id, reporter_user_id);
