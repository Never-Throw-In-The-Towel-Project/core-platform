-- ============================================================================
-- PHASE 9 (2/3) — Per-user timezone, replacing the UTC-only simplification
-- flagged since Phase 1 (see docs/ARCHITECTURE.md "Daily core loop"): every
-- day/week-journey boundary (Morning/Night Routine cutover, which weekday
-- check-in is "today", Sunday Setup's Sunday gate) was resolved in server
-- UTC, so a user near a date boundary could see their "morning" flip over at
-- a UTC-relative time rather than their own local midday/7pm.
--
-- Defaults to 'Europe/London' -- NTITT's home market -- for existing rows
-- and any future row that doesn't set one explicitly (there's no signup
-- flow yet that asks; see docs/ARCHITECTURE.md Open items). Not validated
-- against a fixed enum of IANA zone names at the database level: the set of
-- valid names isn't something Postgres tracks natively short of relying on
-- its own tzdata table, and validating in application code (where the value
-- is actually set) is enough here -- the RLS boundary this schema cares
-- about doesn't depend on this column's value being correct, only on it
-- existing.
-- ============================================================================

alter table public.profiles
  add column timezone text not null default 'Europe/London';
