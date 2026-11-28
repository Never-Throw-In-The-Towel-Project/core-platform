-- ============================================================================
-- Trial-ending reminder idempotency (Phase 1 B2C — PR 6).
-- ============================================================================
-- The trial-reminders cron (src/app/api/jobs/trial-reminders) emails a Direct
-- member a day or two before their no-card app-trial ends. This stamps when that
-- reminder went out so the same trial is never emailed twice. Service-role
-- written (the cron) — members never write public.subscriptions, so no grant
-- change and the existing own-row SELECT policy already exposes it to the owner.
-- ============================================================================
alter table public.subscriptions add column trial_reminder_sent_at timestamptz;
