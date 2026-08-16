-- ============================================================================
-- EVENT GUEST BOOKING (Phase 2). Lets a logged-out visitor on the marketing
-- site book onto a published GLOBAL event with just a name + email, no account.
--
-- The write path is DOUBLE OPT-IN, and this is the whole anti-abuse design:
--   1. The public form inserts a row with status = 'pending' (via the service
--      role -- there is deliberately no anon INSERT policy on event_bookings).
--      A 'pending' row holds NO seat: capacity counts 'confirmed' only, so a
--      spam booking can never fill an event or bump a real member.
--   2. A tokenised link emailed to that address calls confirm_guest_booking(),
--      which is what actually claims a seat (or waitlists). An address that
--      never clicks never consumes anything.
--
-- These two functions are the guest analogues of book_event()/cancel_my_booking()
-- from the Phase 1 migration, keyed by the BOOKING id rather than auth.uid()
-- (a guest has no session). They are SECURITY DEFINER + service_role-only execute:
-- unreachable via PostgREST rpc for anon/authenticated, only ever called by the
-- /api/events/confirm|cancel route handlers AFTER they verify the booking's HMAC
-- token. They lock the event row, so guest and member bookings can't oversell a
-- shared cap. No schema change -- the guest columns already exist on
-- event_bookings from the Phase 1 migration.
-- ============================================================================


-- Confirm a pending guest booking: claim a seat, or waitlist if the event is
-- full. Idempotent -- re-confirming an already-confirmed/waitlisted booking just
-- returns its current status. Returns 'confirmed' or 'waitlisted'.
create or replace function public.confirm_guest_booking(p_booking_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bk public.event_bookings%rowtype;
  v_ev public.events%rowtype;
  v_confirmed int;
  v_status text;
begin
  select * into v_bk from public.event_bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if v_bk.guest_email is null then
    raise exception 'not a guest booking' using errcode = 'P0001';
  end if;
  -- Idempotent: already claimed a place.
  if v_bk.status in ('confirmed', 'waitlisted') then
    return v_bk.status;
  end if;
  if v_bk.status = 'cancelled' then
    raise exception 'booking cancelled' using errcode = 'P0001';
  end if;

  -- status = 'pending' -> claim. Lock the event to serialise against other bookings.
  select * into v_ev from public.events where id = v_bk.event_id for update;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  if not v_ev.is_published or v_ev.cancelled_at is not null then
    raise exception 'event not bookable' using errcode = 'P0001';
  end if;

  select count(*) into v_confirmed
    from public.event_bookings
    where event_id = v_bk.event_id and status = 'confirmed' and id <> p_booking_id;

  if v_ev.capacity is null or v_confirmed < v_ev.capacity then
    v_status := 'confirmed';
  else
    v_status := 'waitlisted';
  end if;

  update public.event_bookings set status = v_status, updated_at = now() where id = p_booking_id;

  update public.events
    set confirmed_count = (
      select count(*) from public.event_bookings
      where event_id = v_bk.event_id and status = 'confirmed'
    )
    where id = v_bk.event_id;

  return v_status;
end;
$$;


-- Cancel a guest booking by id (from the emailed tokenised link). Frees a seat
-- and auto-promotes the oldest waitlister, exactly like cancel_my_booking().
-- Idempotent (no-op if already cancelled or never confirmed).
create or replace function public.cancel_guest_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bk public.event_bookings%rowtype;
  v_ev public.events%rowtype;
  v_old_status text;
  v_confirmed int;
  v_promote_id uuid;
begin
  select * into v_bk from public.event_bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if v_bk.status = 'cancelled' then
    return;
  end if;
  v_old_status := v_bk.status;

  select * into v_ev from public.events where id = v_bk.event_id for update;

  update public.event_bookings set status = 'cancelled', updated_at = now() where id = p_booking_id;

  -- A freed confirmed seat on a capped event promotes the oldest waitlister.
  if v_old_status = 'confirmed' and v_ev.capacity is not null then
    select count(*) into v_confirmed
      from public.event_bookings where event_id = v_bk.event_id and status = 'confirmed';
    if v_confirmed < v_ev.capacity then
      select id into v_promote_id
        from public.event_bookings
        where event_id = v_bk.event_id and status = 'waitlisted'
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
      where event_id = v_bk.event_id and status = 'confirmed'
    )
    where id = v_bk.event_id;
end;
$$;

-- service_role only: these are called exclusively by the confirm/cancel route
-- handlers (via the service-role admin client) after HMAC-token verification.
-- NOT granted to anon/authenticated, so they can't be invoked through PostgREST.
grant execute on function public.confirm_guest_booking(uuid) to service_role;
grant execute on function public.cancel_guest_booking(uuid) to service_role;
