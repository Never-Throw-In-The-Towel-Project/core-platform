-- ============================================================================
-- FIX (events review, round 2):
--
-- (1) book_event() had NO past-event guard. The member UI hides the booking
--     button for events that have already started, but a crafted rpc call to
--     book_event() could still confirm/waitlist a seat on a finished event. The
--     guest path (requestGuestBooking) already rejects past events; this makes
--     the member path consistent. CREATE OR REPLACE adds a starts_at guard and
--     is otherwise byte-for-byte the prior body -- grants are preserved by
--     REPLACE, so book_event stays callable by `authenticated`.
--
-- (2) Raising an event's capacity never promoted existing waitlisters --
--     promotion lived ONLY in the cancel functions, triggered by a cancellation.
--     So an admin raising the cap left freed seats empty while earlier
--     waitlisters stayed stuck and later bookers leapfrogged them.
--     reconcile_event_capacity() promotes the oldest waitlisters up to capacity
--     and recomputes confirmed_count; updateEvent (the server action) calls it
--     after an authorised edit. It PROMOTES ONLY -- it never demotes a confirmed
--     attendee -- so lowering capacity leaves existing confirmed bookings intact
--     and simply waitlists new ones until confirmed drops below the cap.
--
-- Additive; no schema change.
-- ============================================================================

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
  -- Past-event guard (parity with requestGuestBooking): can't book or waitlist an
  -- event that has already started.
  if v_ev.starts_at < now() then
    raise exception 'event has already started' using errcode = 'P0001';
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

-- Promote waitlisters into available capacity and recompute confirmed_count.
-- Called after an admin edits an event (where the capacity may have risen).
-- PROMOTES ONLY, never demotes -- so lowering capacity is, beyond recomputing the
-- count, a no-op here. Idempotent: does nothing when nothing can be promoted.
create or replace function public.reconcile_event_capacity(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ev public.events%rowtype;
  v_confirmed int;
  v_free int;
begin
  -- Lock the event row so a concurrent book_event/cancel can't race the promotion.
  select * into v_ev from public.events where id = p_event_id for update;
  if not found then
    return;
  end if;

  if v_ev.capacity is not null then
    select count(*) into v_confirmed
      from public.event_bookings where event_id = p_event_id and status = 'confirmed';
    v_free := v_ev.capacity - v_confirmed;
    if v_free > 0 then
      update public.event_bookings
        set status = 'confirmed', updated_at = now()
        where id in (
          select id from public.event_bookings
          where event_id = p_event_id and status = 'waitlisted'
          order by created_at asc
          limit v_free
          for update skip locked
        );
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

-- service_role only: reconcile is called by updateEvent through the service-role
-- admin client AFTER the RLS-checked event update has authorised the editor.
-- Postgres grants EXECUTE to PUBLIC by default on CREATE FUNCTION, so revoke it
-- (same lockdown as the guest booking functions) -- nothing anon/authenticated
-- may invoke it directly via PostgREST.
revoke execute on function public.reconcile_event_capacity(uuid) from public, anon, authenticated;
grant execute on function public.reconcile_event_capacity(uuid) to service_role;
