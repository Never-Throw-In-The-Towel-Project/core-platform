-- ============================================================================
-- Waitlist promotion was silent (G1b). When cancel_my_booking / cancel_guest_
-- booking free a confirmed seat they auto-promote the oldest waitlister -- but
-- returned nothing, so the app couldn't tell WHO was promoted to notify them,
-- and the booking copy's "we'll move you up the moment a spot frees" promise was
-- never kept. These two now RETURN the promoted booking id (or null).
--
-- A return type can't be changed with CREATE OR REPLACE, so each is dropped and
-- recreated with an identical body bar the return. Grants are re-established to
-- match exactly what they had: cancel_my_booking keeps the default PUBLIC execute
-- (members call it from their own session); cancel_guest_booking is re-locked to
-- service_role only (its callers go through the admin client). reconcile_event_
-- capacity is deliberately left as-is (void) -- it can promote several at once,
-- and updateEvent detects those by a before/after diff rather than a set return.
-- Additive; no schema change.
-- ============================================================================

-- ---- cancel_my_booking: returns the promoted booking id (or null) ----------
drop function if exists public.cancel_my_booking(uuid);
create function public.cancel_my_booking(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ev public.events%rowtype;
  v_old_status text;
  v_confirmed int;
  v_promote_id uuid := null;
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
    return null;  -- nothing active to cancel
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

  return v_promote_id;
end;
$$;

-- ---- cancel_guest_booking: returns the promoted booking id (or null) --------
drop function if exists public.cancel_guest_booking(uuid);
create function public.cancel_guest_booking(p_booking_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bk public.event_bookings%rowtype;
  v_ev public.events%rowtype;
  v_old_status text;
  v_confirmed int;
  v_promote_id uuid := null;
begin
  select * into v_bk from public.event_bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if v_bk.status = 'cancelled' then
    return null;
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

  return v_promote_id;
end;
$$;

-- Re-lock cancel_guest_booking to service_role (dropped grant is gone with the
-- old function): callers reach it through the admin client after HMAC-token
-- verification, never directly via PostgREST.
revoke execute on function public.cancel_guest_booking(uuid) from public, anon, authenticated;
grant execute on function public.cancel_guest_booking(uuid) to service_role;
