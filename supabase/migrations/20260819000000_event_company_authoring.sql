-- ============================================================================
-- EVENTS Phase 3: per-company events, authored by hr_admins.
--
-- Phase 1 shipped the events table with a nullable company_id (NULL = NTITT-
-- global) but only ever wrote global events (ntitt_admin only). This adds the
-- second author: an hr_admin can create events for their OWN company, visible
-- only to that company's staff, never public, never on another tenant. It is
-- purely additive -- new RLS policies + one CHECK, no schema change (company_id
-- already exists).
--
-- The shape mirrors company_step_challenges exactly (HR reads/writes scoped to
-- their own profile.company_id; the shared self-signup pool is barred by CHECK).
-- Global events (company_id NULL) remain ntitt_admin-only via the Phase 1
-- policies; these HR policies only ever match rows whose company_id equals the
-- acting HR admin's company.
-- ============================================================================


-- The shared self-signup pool ("NTITT Direct", DIRECT_COMPANY_ID) aggregates
-- unrelated individuals -- a "company event" there is meaningless and a privacy
-- risk, same rationale as company_step_challenges. Global events (NULL) and real
-- company events are unaffected.
alter table public.events
  add constraint events_not_direct_pool
  check (company_id is null or company_id <> '00000000-0000-0000-0000-000000000001');


-- ---- events: hr_admin reads their OWN company's events (incl. drafts) --------
-- Phase 1's "members read own company published events" only exposes PUBLISHED
-- rows; an HR admin managing the events needs to see their drafts too. Scoped to
-- authenticated (reads public.profiles), like the other role-gated read policies.
create policy "hr admins read all own company events"
  on public.events for select
  to authenticated
  using (
    events.company_id is not null
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'hr_admin' and p.company_id = events.company_id
    )
  );


-- ---- events: hr_admin writes, scoped to their OWN company --------------------
-- INSERT with-check pins company_id to the admin's own company (so HR can never
-- create a global event or one for another tenant). UPDATE/DELETE match only
-- rows already owned by their company.
create policy "hr admins create own company events"
  on public.events for insert
  with check (
    events.company_id is not null
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'hr_admin' and p.company_id = events.company_id
    )
  );

create policy "hr admins update own company events"
  on public.events for update
  using (
    events.company_id is not null
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'hr_admin' and p.company_id = events.company_id
    )
  )
  with check (
    events.company_id is not null
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'hr_admin' and p.company_id = events.company_id
    )
  );

create policy "hr admins delete own company events"
  on public.events for delete
  using (
    events.company_id is not null
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'hr_admin' and p.company_id = events.company_id
    )
  );


-- ---- event_bookings: hr_admin reads the roster for their OWN company events --
-- An event RSVP is not private wellbeing data (unlike steps/check-ins, which no
-- policy ever exposes to HR) -- the HR admin running the event needs to see who's
-- coming. Scoped to bookings whose event belongs to the admin's company. All
-- bookings on a company event are that company's own members anyway, since
-- book_event() only lets a company's members book its events.
create policy "hr admins read own company event bookings"
  on public.event_bookings for select
  using (
    exists (
      select 1
      from public.events e
      join public.profiles p on p.id = auth.uid()
      where e.id = event_bookings.event_id
        and e.company_id is not null
        and e.company_id = p.company_id
        and p.role = 'hr_admin'
    )
  );
