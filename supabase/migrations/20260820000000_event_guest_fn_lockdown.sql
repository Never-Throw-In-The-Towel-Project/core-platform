-- ============================================================================
-- FIX (events review): the guest booking functions were NOT actually
-- service_role-only. Postgres grants EXECUTE to PUBLIC by default on CREATE
-- FUNCTION, and PUBLIC includes anon + authenticated -- so despite the prior
-- migration's `grant execute ... to service_role` and its comment claiming the
-- functions were unreachable via PostgREST, any holder of the public anon key
-- could call rpc/confirm_guest_booking or rpc/cancel_guest_booking directly,
-- bypassing the HMAC-token check that lives in the route handler.
--
-- cancel_guest_booking in particular had NO internal authorization (no auth.uid,
-- no token), so a caller with a booking id could grief-cancel bookings and
-- shuffle waitlists. This migration:
--   1. REVOKEs execute from public/anon/authenticated (service_role keeps it via
--      the explicit grant re-issued below) -- the actual fix.
--   2. Adds a defense-in-depth guard so cancel_guest_booking can only ever touch
--      a GUEST booking (guest_email not null), never a member's row, even if it
--      were somehow reachable again.
-- Additive; redefines the function body + fixes the grants. No schema change.
-- ============================================================================

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
  -- Defense in depth: this is the GUEST cancel path only. A member cancellation
  -- goes through cancel_my_booking (keyed by auth.uid()); never let this touch a
  -- member's booking row.
  if v_bk.guest_email is null then
    raise exception 'not a guest booking' using errcode = 'P0001';
  end if;
  if v_bk.status = 'cancelled' then
    return;
  end if;
  v_old_status := v_bk.status;

  select * into v_ev from public.events where id = v_bk.event_id for update;

  update public.event_bookings set status = 'cancelled', updated_at = now() where id = p_booking_id;

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

-- Lock both guest functions down to the service role. The route handlers call
-- them via the service-role admin client AFTER verifying the HMAC token; nothing
-- else may invoke them.
revoke execute on function public.confirm_guest_booking(uuid) from public, anon, authenticated;
revoke execute on function public.cancel_guest_booking(uuid) from public, anon, authenticated;
grant execute on function public.confirm_guest_booking(uuid) to service_role;
grant execute on function public.cancel_guest_booking(uuid) to service_role;
