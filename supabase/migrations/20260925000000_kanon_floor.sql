-- ============================================================================
-- k-anonymity floor for company aggregates (finding B1).
-- ============================================================================
-- The HR dashboard + 90-day impact PDF read three company-level aggregate
-- tables: company_daily_participation, company_review_completions,
-- company_support_counts. At a company with only 1-4 enrolled employees these
-- "company-wide" figures ARE one individual's private behaviour -- which days
-- their single reporter did the morning/night routine, whether they completed a
-- review, that they pressed Ask-for-Support (and when). That is exactly what the
-- dashboard promises it never shows: "No names, no answers, no individual scores
-- -- by design." There was no minimum-group-size floor (finding B1). Company
-- step challenges already enforce one (STEP_CHALLENGE_MIN_CONTRIBUTORS = 5); this
-- brings the same floor to the rest of the aggregates.
--
-- Enforced in RLS, NOT just the app. An hr_admin can read these tables directly
-- over the REST API (they hold a SELECT policy for their own company), so hiding
-- the numbers only in the UI would be trivially bypassable. Instead the real
-- values stay in the tables and an hr_admin's own read is gated on the company
-- having >= 5 enrolled employees. service_role bypasses RLS entirely, so the
-- day-90 report job and the ntitt_admin cross-company overview still read every
-- company in full (the day-90/on-demand PDF applies the same floor in code,
-- since it runs as service_role and RLS would not gate it there).

-- Enrolled-employee headcount for a company. SECURITY DEFINER so it can count
-- across profiles, which is otherwise self-read-only under RLS; STABLE + an empty
-- search_path per the standard safe-definer pattern. `employee` mirrors the
-- aggregation job's own eligible_count basis (hr_admins are correctly not
-- counted -- the floor protects the employees whose behaviour is aggregated).
create or replace function public.company_headcount(cid uuid)
returns integer
language sql
security definer
stable
set search_path = ''
as $$
  select count(*)::int
  from public.profiles
  where company_id = cid and role = 'employee'
$$;

revoke all on function public.company_headcount(uuid) from public;
grant execute on function public.company_headcount(uuid) to authenticated, service_role;

comment on function public.company_headcount(uuid) is
  'Enrolled-employee count for a company. Backs the k-anon floor (finding B1): the RLS read policies on the company_* aggregate tables require >= 5, and the impact PDF checks it in code. Keep the 5 in lockstep with MIN_COMPANY_GROUP_SIZE (src/lib/dashboard/aggregates.ts).';

-- Recreate each HR read policy with the k-anon floor appended. Identical
-- own-company hr_admin predicate to init_schema.sql, plus: the company must have
-- at least 5 enrolled employees. Dropping + recreating (rather than adding a
-- second permissive policy) keeps a single policy per table whose USING clause
-- is the whole rule -- a second permissive policy would OR back in the very rows
-- this is meant to hide.
drop policy if exists "hr admins read their own company support counts" on public.company_support_counts;
create policy "hr admins read their own company support counts"
  on public.company_support_counts for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'hr_admin'
        and p.company_id = company_support_counts.company_id
    )
    and public.company_headcount(company_support_counts.company_id) >= 5
  );

drop policy if exists "hr admins read their own company participation" on public.company_daily_participation;
create policy "hr admins read their own company participation"
  on public.company_daily_participation for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'hr_admin'
        and p.company_id = company_daily_participation.company_id
    )
    and public.company_headcount(company_daily_participation.company_id) >= 5
  );

drop policy if exists "hr admins read their own company review completions" on public.company_review_completions;
create policy "hr admins read their own company review completions"
  on public.company_review_completions for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'hr_admin'
        and p.company_id = company_review_completions.company_id
    )
    and public.company_headcount(company_review_completions.company_id) >= 5
  );
