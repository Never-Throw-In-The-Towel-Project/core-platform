-- ============================================================================
-- Performance: index the hottest read paths (Load-Time Teardown, Tier 1).
--
-- Purely additive -- CREATE INDEX only, no data or schema change, so it is safe
-- to apply to prod at any time. The affected tables are small at this stage, so
-- a plain (briefly write-locking) build finishes instantly; if any of these
-- grows large later, rebuild that one CONCURRENTLY out-of-band instead (CREATE
-- INDEX CONCURRENTLY cannot run inside the migration transaction).
-- ============================================================================

-- community_posts had NO index beyond its primary key. The feed
-- (getPosts / countWinsPosts, src/lib/community/queries.ts) filters
-- scope + board, excludes moderated-away posts, and orders newest-first.
-- Partial on `is_removed = false` because the feed always excludes removed
-- posts (moderation reads a separate path).
create index if not exists community_posts_feed_idx
  on public.community_posts (scope, board, created_at desc)
  where is_removed = false;

-- The company-scoped feed adds an equality on company_id (the selective
-- column, so it leads its own index).
create index if not exists community_posts_company_feed_idx
  on public.community_posts (company_id, board, created_at desc)
  where is_removed = false;

-- community_comments was indexed on parent_comment_id only. The feed reads
-- comments by post_id -- getComments (.eq post_id) and getPosts' comment-count
-- batch (.in post_id) -- ordered oldest-first, excluding removed comments.
create index if not exists community_comments_post_idx
  on public.community_comments (post_id, created_at)
  where is_removed = false;

-- content_items was indexed on folder_id / scheduled_for only. The Today
-- day-carousel (getDayContent) filters is_published + day_of_week newest-first;
-- the Library "picked for you" / browse reads (listPickedForYou /
-- listContentItems) filter is_published + type newest-first.
create index if not exists content_items_pub_day_created_idx
  on public.content_items (is_published, day_of_week, created_at desc);

create index if not exists content_items_pub_type_created_idx
  on public.content_items (is_published, type, created_at desc);
