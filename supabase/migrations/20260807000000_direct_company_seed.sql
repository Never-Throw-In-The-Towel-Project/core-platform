-- Seeds the single shared "company" row that every direct/public signup
-- (src/lib/actions/signup.ts) is assigned to -- profiles.company_id is
-- not null, and until now the only source of a company_id was an admin
-- invite (src/lib/actions/invite.ts). Partner co-branded companies (see
-- supabase/seed.sql) stay invite-only; this is the one row self-service
-- signups use instead of inventing a "no company" concept that would touch
-- every company_id-scoped RLS policy and aggregate table.
--
-- Hardcoded id (not gen_random_uuid()) so app code can reference it as a
-- constant instead of a runtime lookup-by-slug -- kept in sync by hand with
-- src/lib/tenant/constants.ts's DIRECT_COMPANY_ID. slug is inert for
-- routing purposes: resolveCompanyForHost (src/lib/tenant/resolve.ts)
-- returns null on the bare root/app domain before ever querying by slug, so
-- this row is never resolved via subdomain matching -- it only exists to
-- satisfy companies.slug's not null unique constraint and give the row
-- sane display fields.
--
-- This is a real migration (unlike supabase/seed.sql, which `supabase db
-- push` never applies to a remote project -- see docs/DEPLOYMENT.md), so it
-- ships automatically through the normal migration pipeline with no extra
-- manual step.
insert into public.companies (id, name, slug, welcome_copy)
values (
  '00000000-0000-0000-0000-000000000001',
  'NTITT Direct',
  'direct',
  'Keep on Living -- welcome to Never Throw In The Towel.'
)
on conflict (id) do nothing;
