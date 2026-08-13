-- ============================================================================
-- COMMUNITY DEPTH (Track 2 · D1, part 1): threaded comment replies.
-- ============================================================================
-- Phase 7 shipped flat comments. This adds one nullable, self-referential
-- column so a comment can be a reply to another comment, turning the flat list
-- into a two-level thread (top-level comments, each with its replies). Purely
-- additive and non-destructive: every existing comment keeps
-- parent_comment_id = NULL and reads exactly as before.
--
-- Privacy/scope is UNCHANGED and still enforced by the hardened INSERT policy
-- from 20260810010000_bind_comment_scope.sql: every comment -- reply or not --
-- must carry the same scope/company_id as its parent POST, so a reply can no
-- more cross a company boundary than a top-level comment can. parent_comment_id
-- only records *which comment* a reply hangs under; it does not influence
-- visibility, so no RLS change is needed here.
--
-- The submitting server action (submitCommunityComment) additionally re-derives
-- the parent server-side and flattens a reply-to-a-reply onto its top-level
-- ancestor, so the thread stays a clean two levels and a reply always sits on
-- the same post as its parent -- the same "re-derive server-side" pattern the
-- rest of this codebase uses (content/challenges). ON DELETE CASCADE keeps the
-- data-integrity path honest: a hard-deleted parent takes its replies with it
-- (day-to-day moderation is soft-delete via is_removed, which this does not
-- touch -- a soft-removed parent's replies simply promote to top level in the
-- reader, so nothing is silently dropped).

alter table public.community_comments
  add column parent_comment_id uuid references public.community_comments (id) on delete cascade;

-- Replies are always fetched by their parent when building the thread, so index
-- that lookup. Partial (only actual replies) to stay small.
create index community_comments_parent_idx
  on public.community_comments (parent_comment_id)
  where parent_comment_id is not null;

comment on column public.community_comments.parent_comment_id is
  'Self-FK: NULL = top-level comment; set = a reply to that comment (same post/scope). Two-level threads only, enforced by the submitting server action.';
