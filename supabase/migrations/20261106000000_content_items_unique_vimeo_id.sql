-- ============================================================================
-- E8 — one Vimeo video ⇒ at most one content_items row.
--
-- The three import paths (manual picker, the Brain "sync entire library"
-- engine + its hourly cron, and the Studio/CSV admin create) all dedup by
-- vimeo_id with a read-then-insert pre-check. That races: two runs can both
-- see a video as absent and both insert it, so duplicate rows can slip in.
-- This migration removes any existing duplicates and then enforces uniqueness
-- with a partial unique index, so the race can never persist a duplicate again.
--
-- The index is PARTIAL (`where vimeo_id is not null`) on purpose: content_items
-- holds video / document / image / text rows, and only `video` rows carry a
-- vimeo_id (the content_items_media_for_type CHECK). Non-video rows legitimately
-- have vimeo_id IS NULL and must not collide with each other.
--
-- DE-DUPLICATION IS DATA-PRESERVING FOR MEMBER DATA. Five tables FK content_items;
-- a naive delete would cascade. For each vimeo_id we keep ONE survivor (the most
-- canonical row — see the ranking) and, before removing the losers:
--   * private.content_progress  — MERGED onto the survivor (keep the furthest
--     watch position / completed flag), so no member loses their "resume where
--     you left off".
--   * public.challenge_days      — RE-POINTED to the survivor, so a programme
--     day keeps its video (the FK is ON DELETE SET NULL, which would otherwise
--     silently blank it).
-- The losers' content_item_topics / content_item_stages / content_channel_
-- placements rows are left to the delete's ON DELETE CASCADE: those are AI- and
-- admin-assigned metadata that the survivor (the published/enriched row) already
-- carries its own copy of, and re-pointing them risks multi-duplicate key
-- collisions for no member-facing gain. (Documented tradeoff.)
--
-- Idempotent: on a database with no duplicates the loser set is empty and this
-- is just the CREATE INDEX.
-- ============================================================================

-- The loser → survivor map. Survivor per vimeo_id is the most canonical row:
-- published first, then the most-enriched (thumbnail, vimeo hash, then tag
-- count), then the earliest import, with a final id tiebreak so the choice is
-- deterministic. Session-scoped temp table (this file is its own psql session).
drop table if exists _vimeo_losers;
create temporary table _vimeo_losers as
with ranked as (
  select
    id,
    vimeo_id,
    row_number() over (
      partition by vimeo_id
      order by
        is_published desc,
        (thumbnail_url is not null) desc,
        (vimeo_hash is not null) desc,
        cardinality(tags) desc,
        created_at asc,
        id asc
    ) as rn
  from public.content_items
  where vimeo_id is not null
)
select loser.id as loser_id, keep.id as survivor_id
from ranked loser
join ranked keep on keep.vimeo_id = loser.vimeo_id and keep.rn = 1
where loser.rn > 1;

-- 1. Merge watch-progress a member already has on BOTH a survivor and its
--    loser(s): keep the furthest position and completed if either was complete.
update private.content_progress cp
set position_seconds = m.max_pos,
    completed = m.any_completed or cp.completed,
    duration_seconds = coalesce(cp.duration_seconds, m.max_duration),
    updated_at = now()
from (
  select l.user_id, map.survivor_id,
         max(l.position_seconds) as max_pos,
         bool_or(l.completed) as any_completed,
         max(l.duration_seconds) as max_duration
  from private.content_progress l
  join _vimeo_losers map on map.loser_id = l.content_item_id
  group by l.user_id, map.survivor_id
) m
where cp.user_id = m.user_id and cp.content_item_id = m.survivor_id;

-- 2. For a member who has progress on a loser but NOT on the survivor, move the
--    furthest loser row onto the survivor (exactly one per user+survivor via
--    distinct on; any others stay on their loser and cascade-delete in step 4).
update private.content_progress cp
set content_item_id = m.survivor_id
from (
  select distinct on (l.user_id, map.survivor_id) l.id, map.survivor_id
  from private.content_progress l
  join _vimeo_losers map on map.loser_id = l.content_item_id
  where not exists (
    select 1 from private.content_progress s
    where s.user_id = l.user_id and s.content_item_id = map.survivor_id
  )
  order by l.user_id, map.survivor_id, l.position_seconds desc, l.completed desc, l.id
) m
where cp.id = m.id;

-- 3. Re-point challenge programme days off the losers onto the survivor (the FK
--    is ON DELETE SET NULL, so a plain delete would blank the day's content).
update public.challenge_days d
set content_item_id = m.survivor_id
from _vimeo_losers m
where d.content_item_id = m.loser_id;

-- 4. Remove the losers. ON DELETE CASCADE now cleans up only what's left on
--    them: their own topic/stage tags, channel placements, and any
--    already-merged (step 1) or surplus (step 2) progress rows.
delete from public.content_items c
using _vimeo_losers m
where c.id = m.loser_id;

drop table _vimeo_losers;

-- Enforce it. Partial so non-video rows (vimeo_id IS NULL) don't collide.
create unique index content_items_vimeo_id_key
  on public.content_items (vimeo_id)
  where vimeo_id is not null;
