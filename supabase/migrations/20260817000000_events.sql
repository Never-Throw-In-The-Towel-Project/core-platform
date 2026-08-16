-- ============================================================================
-- EVENTS — real-world community meet-ups (cold-plunge river dips, walks, socials)
-- that Anthony's team list and members book onto. Sits alongside the content
-- spine as a fourth authored surface, but unlike content it is deliberately
-- shown on THREE tiers: the super-admin Studio, the members' app, AND the
-- logged-out marketing site (so a prospective member can see what's on before
-- signing up).
--
-- Two tables, split on the platform's usual line:
--   * PUBLIC DEFINITION — `events` (title, when, where, capacity, image). Written
--     by ntitt_admin. Its READ policy is unusual for this codebase: a published
--     GLOBAL event (company_id IS NULL) is readable by the `anon` role too, the
--     same public-read shape the `companies` branding row already uses. That is
--     the whole point of the marketing-site surface. Company-scoped events
--     (company_id set) are never public and never cross tenants.
--   * BOOKINGS — `event_bookings`. NOT private-schema/own-rows like challenge
--     participation, because Anthony's team must see the attendee + waitlist
--     roster (capacity management, "who's coming"). So bookings live in `public`
--     with member-reads-own + ntitt_admin-reads-all RLS. A booking is either a
--     member (user_id) OR a guest (name+email) — never both (CHECK) — so the
--     same table serves the signed-in one-tap flow and the guest flow (the guest
--     write path arrives in a later slice; the columns exist now so the model
--     doesn't churn).
--
-- CAPACITY + WAITLIST are enforced by a SECURITY DEFINER function, book_event(),
-- NOT by client code: only a definer function can (a) count OTHER members'
-- bookings (RLS hides them from a member) and (b) keep events.confirmed_count in
-- step, both of which the capacity decision needs. It locks the event row, so
-- two members racing for the last seat can't both be confirmed. cancel_my_booking()
-- is its mirror: it frees a seat and auto-promotes the oldest waitlister. There
-- is deliberately NO member INSERT/UPDATE policy on event_bookings — every write
-- goes through these two functions, so capacity can't be bypassed by a direct
-- insert.
--
-- Additive and non-destructive. No existing table is touched. company_id is
-- present but only ever NULL in this slice (all events are NTITT-global);
-- per-company (hr_admin-authored) events are a later, additive increment that
-- reuses this exact column + the company-scoped read policy already written here.
-- ============================================================================


-- ---- events: the public definition (ntitt_admin-authored) -------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  -- NULL = NTITT-global (public + every member, all tenants). Set = one company's
  -- own event (its staff only, never public). ON DELETE CASCADE: deleting a
  -- company removes its events with it.
  company_id uuid references public.companies (id) on delete cascade,
  title text not null,
  -- URL slug for /events/<slug> on the members' + marketing surfaces. Unique so
  -- the public route is unambiguous; generated from the title by the create action.
  slug text not null unique,
  summary text,                                  -- one-line teaser for cards
  description text,                              -- full body on the detail page
  starts_at timestamptz not null,
  ends_at timestamptz,                           -- optional; open-ended if null
  location_name text,                            -- e.g. "Alnwick Garden, cascade"
  location_url text,                             -- optional map/venue link
  image_url text,                                -- hero image (URL or /site path)
  -- NULL = unlimited. A positive integer caps confirmed bookings; further
  -- bookings are waitlisted by book_event() until a seat frees.
  capacity int check (capacity is null or capacity > 0),
  -- Denormalised confirmed-booking tally, kept in step by the booking functions.
  -- Exists so the PUBLIC (anon) surface can show "12 / 20 booked" / "Full"
  -- WITHOUT exposing the bookings table to anon.
  confirmed_count int not null default 0 check (confirmed_count >= 0),
  is_published boolean not null default false,   -- Studio drafts, then publishes
  cancelled_at timestamptz,                      -- set = the event was called off
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events enable row level security;

create index events_starts_at_idx on public.events (starts_at);
create index events_company_id_idx on public.events (company_id);
create index events_published_starts_idx on public.events (is_published, starts_at);


-- ---- event_bookings: who's coming (public, roster-visible to ntitt_admin) ----
create table public.event_bookings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  -- A member booking carries user_id; a guest booking carries name+email. The
  -- CHECK makes "exactly one identity" a table invariant.
  user_id uuid references auth.users (id) on delete cascade,
  guest_name text,
  guest_email text,
  -- confirmed = has a seat; waitlisted = event full, will auto-promote on a
  -- cancellation; pending = guest booking awaiting email confirmation (later
  -- slice); cancelled = withdrawn (kept for the roster/history).
  status text not null default 'confirmed'
    check (status in ('confirmed', 'waitlisted', 'pending', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_bookings_identity_chk
    check ((user_id is not null) <> (guest_email is not null))
);

alter table public.event_bookings enable row level security;

-- One ACTIVE identity per event: a member (or a given guest email) holds at most
-- one non-cancelled booking, but may re-book after cancelling. Partial so
-- cancelled rows never block a fresh booking. NOTE: book_event() upserts on the
-- member index below, so a member keeps ONE row whose status toggles.
create unique index event_bookings_member_uniq
  on public.event_bookings (event_id, user_id) where user_id is not null;
create unique index event_bookings_guest_uniq
  on public.event_bookings (event_id, lower(guest_email))
  where guest_email is not null and status <> 'cancelled';
create index event_bookings_event_status_idx
  on public.event_bookings (event_id, status);


-- ---- grants ----------------------------------------------------------------
-- `alter default privileges` in the init migration only covers tables made in a
-- later session; these are new, so grant explicitly (same note as the challenges
-- migration). events is additionally granted to `anon` for the marketing surface
-- (all its columns are public-safe — no PII). event_bookings is NEVER granted to
-- anon. Members are granted insert/update/delete on bookings, but with NO member
-- write POLICY, so every direct write is denied by RLS and must go through the
-- booking functions; the grants exist only so the ntitt_admin roster policies
-- have something to attach to.
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.event_bookings to authenticated;


-- ---- RLS: events reads -----------------------------------------------------
-- (A) PUBLIC: a published GLOBAL event is readable by everyone, including the
-- anon role on the marketing site. No role gate -> anon satisfies it. Cancelled
-- events remain readable (so a booked member/visitor sees the "cancelled" state);
-- freshness/cancelled filtering is done in the query layer, not here.
create policy "public read published global events"
  on public.events for select
  using (is_published and company_id is null);

-- (B) MEMBERS also see their OWN company's published events (never another
-- company's, never the public). Mirrors the content spine's company scoping.
-- Scoped `to authenticated`: this policy reads public.profiles, which the anon
-- role has no privilege on, and Postgres evaluates EVERY permissive SELECT
-- policy for the querying role. Without the role scope, an anon read of events
-- would error ("permission denied for table profiles") instead of just falling
-- through to policy (A). Same reason policy (C) is authenticated-only.
create policy "members read own company published events"
  on public.events for select
  to authenticated
  using (
    is_published
    and company_id is not null
    and company_id = (select p.company_id from public.profiles p where p.id = auth.uid())
  );

-- (C) ntitt_admin sees everything, including drafts and every company's events.
create policy "ntitt admins read all events"
  on public.events for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));


-- ---- RLS: events writes are ntitt_admin only (this slice) -------------------
-- Per-company (hr_admin) authoring is a later increment; it will add a parallel
-- hr_admin-for-own-company write policy, exactly like company_step_challenges.
create policy "ntitt admins create events"
  on public.events for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins update events"
  on public.events for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins delete events"
  on public.events for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));


-- ---- RLS: event_bookings ---------------------------------------------------
-- Members read only their OWN booking (to render their status). ntitt_admin
-- reads/updates/deletes ALL bookings (the attendee + waitlist roster, and
-- removing a booking). There is intentionally NO member INSERT/UPDATE policy:
-- bookings are created and mutated ONLY by book_event()/cancel_my_booking().
create policy "members read own bookings"
  on public.event_bookings for select
  using (auth.uid() = user_id);

create policy "ntitt admins read all bookings"
  on public.event_bookings for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins update bookings"
  on public.event_bookings for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins delete bookings"
  on public.event_bookings for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));


-- ============================================================================
-- BOOKING FUNCTIONS. SECURITY DEFINER so they can count every booking on the
-- event (RLS hides other members' rows from a member) and keep confirmed_count
-- current (members can't UPDATE events). `set search_path = public` pins schema
-- resolution. auth.uid() is the ONLY identity used — a caller can never book or
-- cancel on behalf of someone else. The event row is locked FOR UPDATE so
-- concurrent bookings on the same event serialise (no over-selling the cap).
-- ============================================================================

-- Book the current member onto an event. Idempotent: re-calling updates the
-- member's single booking row. Returns the resulting status ('confirmed' or
-- 'waitlisted'). Raises if the event isn't bookable by this member.
create or replace function public.book_event(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ev public.events%rowtype;
  v_member_company uuid;
  v_confirmed int;
  v_status text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Lock the event row: serialises concurrent bookings competing for the cap.
  select * into v_ev from public.events where id = p_event_id for update;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  if not v_ev.is_published or v_ev.cancelled_at is not null then
    raise exception 'event not bookable' using errcode = 'P0001';
  end if;

  -- Company-scoped events are bookable only by that company's members.
  if v_ev.company_id is not null then
    select p.company_id into v_member_company from public.profiles p where p.id = v_uid;
    if v_member_company is distinct from v_ev.company_id then
      raise exception 'event not bookable' using errcode = 'P0001';
    end if;
  end if;

  -- Count confirmed bookings held by OTHER members; the caller's own seat (if any)
  -- doesn't count against them, so re-booking never bumps someone to the waitlist.
  select count(*) into v_confirmed
    from public.event_bookings
    where event_id = p_event_id and status = 'confirmed' and user_id is distinct from v_uid;

  if v_ev.capacity is null or v_confirmed < v_ev.capacity then
    v_status := 'confirmed';
  else
    v_status := 'waitlisted';
  end if;

  insert into public.event_bookings (event_id, user_id, status)
    values (p_event_id, v_uid, v_status)
  on conflict (event_id, user_id) where user_id is not null
    do update set status = excluded.status, updated_at = now();

  update public.events
    set confirmed_count = (
      select count(*) from public.event_bookings
      where event_id = p_event_id and status = 'confirmed'
    )
    where id = p_event_id;

  return v_status;
end;
$$;

-- Cancel the current member's booking. Idempotent (no-op if not booked). If a
-- CONFIRMED seat is freed and the event has a cap, the oldest waitlister is
-- promoted to confirmed.
create or replace function public.cancel_my_booking(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ev public.events%rowtype;
  v_old_status text;
  v_confirmed int;
  v_promote_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_ev from public.events where id = p_event_id for update;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  select status into v_old_status
    from public.event_bookings
    where event_id = p_event_id and user_id = v_uid and status <> 'cancelled'
    for update;
  if v_old_status is null then
    return;  -- nothing active to cancel
  end if;

  update public.event_bookings
    set status = 'cancelled', updated_at = now()
    where event_id = p_event_id and user_id = v_uid and status <> 'cancelled';

  -- A freed confirmed seat on a capped event promotes the oldest waitlister.
  if v_old_status = 'confirmed' and v_ev.capacity is not null then
    select count(*) into v_confirmed
      from public.event_bookings where event_id = p_event_id and status = 'confirmed';
    if v_confirmed < v_ev.capacity then
      select id into v_promote_id
        from public.event_bookings
        where event_id = p_event_id and status = 'waitlisted'
        order by created_at asc
        limit 1
        for update skip locked;
      if v_promote_id is not null then
        update public.event_bookings set status = 'confirmed', updated_at = now()
          where id = v_promote_id;
      end if;
    end if;
  end if;

  update public.events
    set confirmed_count = (
      select count(*) from public.event_bookings
      where event_id = p_event_id and status = 'confirmed'
    )
    where id = p_event_id;
end;
$$;

grant execute on function public.book_event(uuid) to authenticated;
grant execute on function public.cancel_my_booking(uuid) to authenticated;
