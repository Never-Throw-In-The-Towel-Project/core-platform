-- ============================================================================
-- CONTENT DISTRIBUTION CALENDAR — dated scheduling. Adds a nullable
-- `scheduled_for` date to content_items so the Super Admin can schedule a piece
-- to go live on a specific date (the "Month" view of /admin/calendar), on top of
-- the recurring day_of_week "Week" framework. See docs/CONTENT_PLATFORM_STRATEGY.md.
--
-- Semantics: a DRAFT (is_published = false) carrying a scheduled_for is
-- auto-published on that date by the publish-scheduled-content cron
-- (src/app/api/jobs/publish-scheduled-content). null = not date-scheduled
-- (managed by is_published + day_of_week only). Additive and non-destructive; no
-- RLS change — adding a nullable column doesn't alter who may read a row, and the
-- cron writes with the service role.
-- ============================================================================

alter table public.content_items add column scheduled_for date;

-- Partial index: the cron and the month view both query by scheduled_for, and
-- only the (minority of) rows that carry one matter.
create index content_items_scheduled_for_idx
  on public.content_items (scheduled_for)
  where scheduled_for is not null;
