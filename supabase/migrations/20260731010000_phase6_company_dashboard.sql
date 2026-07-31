-- ============================================================================
-- PHASE 6 — COMPANY DASHBOARD: tracks whether the auto-generated 90-day HR
-- impact report has already been sent for a company, so the cron job that
-- generates and emails it doesn't resend it every time it runs after the
-- milestone passes. Everything else the dashboard needs
-- (company_support_counts, company_daily_participation,
-- company_review_completions) already exists from Phase 1.
-- ============================================================================

alter table public.companies
  add column ninety_day_report_sent_at timestamptz;
