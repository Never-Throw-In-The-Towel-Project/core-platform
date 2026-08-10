-- ============================================================================
-- SECURITY: stop exposing company support-contact PII to anon/authenticated.
-- ============================================================================
-- Found in the full-platform security review. `companies` has an RLS policy
-- `using (true)` so its rows are world-readable pre-auth (needed: the proxy
-- resolves a subdomain to a company to brand the login page). But RLS is
-- row-level, not column-level, so `using (true)` also exposes
-- support_contact_name/phone/email -- the real phone/email of the
-- first-aiders / Anthony that Ask-for-Support alerts route to -- and
-- ninety_day_report_sent_at, to anyone holding the public anon key. The
-- init migration's comment "Nothing sensitive lives on this table" was
-- inaccurate. Latent today only because seeded companies have null contacts.
--
-- Fix: column-level SELECT. Revoke the table-wide SELECT that Supabase grants
-- anon/authenticated by default and re-grant only the branding/identity
-- columns those roles legitimately need pre- and post-auth. The RLS policy
-- (row visibility) is unchanged. service_role is untouched, so the admin
-- client still reads contacts for alert routing and report generation.
--
-- App-side companion changes shipped alongside this migration so no
-- session/anon-client read selects a now-revoked column (which would
-- otherwise error, not silently drop the column, on `select *`):
--   * src/lib/tenant/resolve.ts -- resolveCompanyForHost now selects an
--     explicit branding-column list instead of `select("*")`.
--   * src/lib/actions/support.ts -- the company support-contact lookup moved
--     from the RLS session client to the service-role admin client (routing
--     info, not the user's own data -- the correct client for it anyway).
-- All other companies readers already select only granted columns
--   (queries.ts: id,name; reports/impact: name) or use the admin client
--   (the two cron jobs + the Twilio webhook).
revoke select on public.companies from anon, authenticated;

grant select (
  id,
  name,
  slug,
  custom_domain,
  logo_url,
  primary_color,
  accent_color,
  welcome_copy,
  created_at
) on public.companies to anon, authenticated;
