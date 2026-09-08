-- ============================================================================
-- STAND fundamentals → the Fundamentals Daily Checklist.
-- ============================================================================
-- Anthony reshaped the Today "fundamentals" widget into his journal's
-- "Fundamentals Daily Checklist": five plain yes/no questions, replacing the
-- previous four discipline ticks (hydration / steps / alcohol-free / healthy
-- food) AND the five reflective text prompts (S-T-A-N-D). Per the owner's call
-- the old columns are DROPPED — the checklist supersedes them — which discards
-- any ticks / reflections logged since the feature shipped (2026-08-29).
--
-- The table, RLS, index and privacy posture are UNCHANGED: still one row per
-- member per local day (unique user_id, entry_date), still in the `private`
-- schema (not exposed via the API — see supabase/config.toml), still
-- own-rows-only via RLS (auth.uid() = user_id), and still referenced by NO
-- aggregate anywhere. HR sees nothing; ntitt_admin sees nothing. Do not add an
-- aggregate over it. Only the day's answer columns change.
--
-- The five questions (verbatim from the journal), each a boolean defaulting
-- false and toggled independently from the Today board:
--   won_morning    — "Did I win my morning?"
--   moved          — "Have I moved today?"
--   talked         — "Did I talk to someone today?"
--   ate_and_drank  — "Have I eaten some natural food and drank some water today?"
--   grateful       — "Have I took notice of something I'm grateful of today?"
alter table private.stand_entries
  drop column hydration,
  drop column steps,
  drop column alcohol_free,
  drop column healthy_food,
  drop column strength_of_connection,
  drop column try_new_things,
  drop column active_lifestyle,
  drop column notice_the_more,
  drop column do_good_for_others,
  add column won_morning boolean not null default false,
  add column moved boolean not null default false,
  add column talked boolean not null default false,
  add column ate_and_drank boolean not null default false,
  add column grateful boolean not null default false;
