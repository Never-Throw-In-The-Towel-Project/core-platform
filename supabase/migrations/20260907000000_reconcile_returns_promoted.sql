-- ============================================================================
-- reconcile_event_capacity now RETURNS the promoted booking ids (review round 3).
--
-- Raising an event's capacity can promote several waitlisters at once. The old
-- function returned void, so updateEvent learned who moved up by a fragile
-- snapshot-diff: read the waitlist ids BEFORE reconcile, then re-read which of
-- them were now 'confirmed' AFTER. That's two extra round-trips and, worse, it
-- MIS-ATTRIBUTES under any concurrency -- a seat freed by a cancel racing the
-- edit, or a separate book_event, could confirm a "before" id that reconcile
-- didn't touch, and we'd email the wrong person "you're off the waitlist".
--
-- The authoritative answer is the set of rows reconcile itself promotes, so it
-- now returns exactly those ids. updateEvent notifies that set directly -- no
-- diff, no race. Body is otherwise byte-for-byte the prior one (lock the event
-- FOR UPDATE, promote the oldest waitlisters up to the freed seats with
-- `for update skip locked`, recompute confirmed_count).
--
-- A return type can't change with CREATE OR REPLACE, so it's dropped and
-- recreated; the default PUBLIC execute grant returns on CREATE, so the
-- service_role-only lockdown is re-applied to match its prior state exactly.
-- Additive; no schema change.
-- ============================================================================

drop function if exists public.reconcile_event_capacity(uuid);
create function public.reconcile_event_capacity(p_event_id uuid)
returns table (booking_id uuid)
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
    return;  -- empty set
  end if;

  if v_ev.capacity is not null then
    select count(*) into v_confirmed
      from public.event_bookings where event_id = p_event_id and status = 'confirmed';
    v_free := v_ev.capacity - v_confirmed;
    if v_free > 0 then
      -- Promote the oldest waitlisters into the freed seats and hand their ids
      -- back to the caller (RETURN QUERY appends to the result set, then execution
      -- continues so confirmed_count is recomputed below before the function ends).
      return query
        update public.event_bookings
          set status = 'confirmed', updated_at = now()
          where id in (
            select id from public.event_bookings
            where event_id = p_event_id and status = 'waitlisted'
            order by created_at asc
            limit v_free
            for update skip locked
          )
        returning id;
    end if;
  end if;

  update public.events
    set confirmed_count = (
      select count(*) from public.event_bookings
      where event_id = p_event_id and status = 'confirmed'
    )
    where id = p_event_id;

  return;
end;
$$;

-- Re-lock to service_role (the recreate restored the default PUBLIC execute):
-- reconcile is called by updateEvent through the service-role admin client AFTER
-- the RLS-checked event update has authorised the editor -- never directly via
-- PostgREST by anon/authenticated.
revoke execute on function public.reconcile_event_capacity(uuid) from public, anon, authenticated;
grant execute on function public.reconcile_event_capacity(uuid) to service_role;
