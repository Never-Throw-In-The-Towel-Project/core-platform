-- ============================================================================
-- Community anonymity, part 3: give invited/legacy members a real anon handle.
-- ============================================================================
-- profiles.display_name is the PUBLIC handle -- what other members see when the
-- author appears anonymously -- while full_name is the admin-visible real name
-- (see 20260908000000). Self-service signup already sets display_name to a
-- generated "Adjective Animal" handle. But two paths left it as the member's
-- REAL name, so choosing "Anonymous" showed exactly the name it was meant to
-- hide (finding A3):
--   1. Invited members: provisionInvite wrote display_name = the admin-typed
--      real name (now fixed in application code to write full_name + a handle).
--   2. Legacy members: 20260908 backfilled full_name := display_name for every
--      pre-existing row, leaving display_name == full_name (their real name).
--
-- This migration backfills a real handle for exactly those rows (display_name
-- still equal to full_name). Members whose preference is full_name/first_name
-- are unaffected in what peers see (that path renders full_name); the handle
-- only ever surfaces when they appear anonymously -- but every such member is
-- now protected the moment they do. Idempotent: once display_name is a handle
-- it no longer equals full_name, so a re-run touches nothing.

-- A stable, non-identifying "Adjective Animal" handle from a seed (the user id).
-- This is a faithful SQL port of generateAnonHandle() in
-- src/lib/identity/preference.ts -- IDENTICAL algorithm and word lists, so a
-- backfilled handle equals the one the app would generate for the same id
-- (assertion 24 locks the two together against drift). Deterministic + immutable.
create or replace function public.generate_anon_handle(seed text)
returns text
language plpgsql
immutable
as $$
declare
  adjectives text[] := array[
    'Quiet','Bright','Steady','Calm','Bold','Kind','Swift','Wise','Warm','Brave','Gentle','Keen'];
  animals text[] := array[
    'Otter','Heron','Fox','Wren','Hare','Finch','Lynx','Robin','Marten','Owl','Stag','Kestrel'];
  h bigint := 0;
  i int;
begin
  -- hash = (hash * 31 + charCode) >>> 0, i.e. unsigned 32-bit wraparound per char.
  for i in 1 .. length(seed) loop
    h := (h * 31 + ascii(substr(seed, i, 1))) % 4294967296;
  end loop;
  -- JS arrays are 0-indexed, Postgres arrays 1-indexed -- hence the + 1.
  return adjectives[(h % 12) + 1] || ' ' || animals[((h / 12) % 12) + 1];
end;
$$;

comment on function public.generate_anon_handle(text) is
  'SQL mirror of generateAnonHandle() (src/lib/identity/preference.ts). Keep in lockstep -- assertion 24 checks known seeds.';

-- Backfill the handle for members whose public handle is still their real name.
update public.profiles
   set display_name = public.generate_anon_handle(id::text)
 where full_name is not null
   and display_name = full_name;
