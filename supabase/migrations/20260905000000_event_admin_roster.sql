-- ============================================================================
-- Event roster management for organisers (G2). The roster panel was display +
-- CSV only: an admin could see who booked but couldn't remove a booking or
-- promote a specific waitlister, even though the ntitt_admin update/delete
-- booking RLS existed and went unused. These two SECURITY DEFINER functions add
-- those actions while keeping capacity/waitlist correct (a plain DELETE via RLS
-- would leave confirmed_count stale and never promote the next in line).
--
-- Same shape + lockdown as reconcile_event_capacity: service_role-only, called
-- by the server actions (adminCancelBooking / adminPromoteBooking) through the
-- admin client AFTER the action has authorised the caller (ntitt_admin on any
-- event; hr_admin only on their own company's). Row is locked FOR UPDATE so a
-- concurrent book/cancel can't race the recompute. Additive; no schema change.
-- ============================================================================

-- Cancel any one booking (member or guest) on behalf of an organiser. If a
-- CONFIRMED seat is freed on a capped event, the oldest waitlister is promoted.
-- Returns the promoted booking's id (or null) so the caller can notify them.
create or replace function public.admin_cancel_booking(p_booking_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bk public.event_bookings%rowtype;
  v_ev public.events%rowtype;
  v_confirmed int;
  v_promote_id uuid := null;
begin
  select * into v_bk from public.event_bookings where id = p_booking_id for update;
  if not found or v_bk.status = 'cancelled' then
    return null;  -- nothing active to cancel
  end if;

  -- Lock the event too, so the count + promotion can't race a concurrent booking.
  select * into v_ev from public.events where id = v_bk.event_id for update;

  update public.event_bookings
    set status = 'cancelled', updated_at = now()
    where id = p_booking_id;

  -- A freed confirmed seat on a capped event promotes the oldest waitlister.
  if v_bk.status = 'confirmed' and v_ev.capacity is not null then
    select count(*) into v_confirmed
      from public.event_bookings where event_id = v_ev.id and status = 'confirmed';
    if v_confirmed < v_ev.capacity then
      select id into v_promote_id
        from public.event_bookings
        where event_id = v_ev.id and status = 'waitlisted'
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
      where event_id = v_ev.id and status = 'confirmed'
    )
    where id = v_ev.id;

  return v_promote_id;
end;
$$;

-- Manually promote a specific waitlisted booking to confirmed (an organiser
-- pulling someone up out of order). No-op unless the booking is currently
-- waitlisted. This can intentionally take confirmed_count above capacity -- an
-- explicit organiser override -- which the capacity meter simply reflects.
create or replace function public.admin_promote_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bk public.event_bookings%rowtype;
begin
  select * into v_bk from public.event_bookings where id = p_booking_id for update;
  if not found or v_bk.status <> 'waitlisted' then
    return;
  end if;

  update public.event_bookings
    set status = 'confirmed', updated_at = now()
    where id = p_booking_id;

  update public.events
    set confirmed_count = (
      select count(*) from public.event_bookings
      where event_id = v_bk.event_id and status = 'confirmed'
    )
    where id = v_bk.event_id;
end;
$$;

-- Lockdown (same as reconcile_event_capacity): the server action authorises the
-- caller and invokes these through the service-role client, so nothing anon/
-- authenticated may call them directly via PostgREST.
revoke execute on function public.admin_cancel_booking(uuid) from public, anon, authenticated;
revoke execute on function public.admin_promote_booking(uuid) from public, anon, authenticated;
grant execute on function public.admin_cancel_booking(uuid) to service_role;
grant execute on function public.admin_promote_booking(uuid) to service_role;
