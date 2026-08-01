-- ============================================================================
-- FIX: sunday_notification_time had no default, so no profile ever had one
-- set and the Sunday Setup reminder cron branch matched zero users. Paired
-- with a day-of-week guard added in
-- src/app/api/jobs/send-push-notifications/route.ts (without that guard,
-- simply adding a default here would make the reminder fire every day
-- instead of never -- this column has no day component of its own, the
-- route decides "is it Sunday" from the user's own timezone).
-- ============================================================================
alter table public.profiles
  alter column sunday_notification_time set default '18:00';

update public.profiles
  set sunday_notification_time = '18:00'
  where sunday_notification_time is null;
