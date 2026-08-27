-- ============================================================================
-- CONTENT STAGES — the member Library's "Where you are" facet. Alongside the
-- broad video_category "theme" and the life-situation TOPIC (content_topics), a
-- piece can speak to WHERE a member is in their journey:
--   * start_here  — foundational, orienting content to begin with
--   * in_it       — for when you're in the thick of it
--   * rebuilding  — for finding your feet again
--
-- Unlike topics (an open, admin-editable taxonomy), the stages are a FIXED,
-- closed set — a deliberate three-phase journey model, not a growing list — so
-- there is NO separate taxonomy table: the stage lives as a CHECK-constrained
-- column on the assignment join, and its labels/order live in code
-- (src/lib/content/stageConfig.ts). Populated by the AI tagging pass (backfill +
-- Vimeo-sync auto-tag) in a follow-up slice, exactly like topics.
--
-- Reads are member-facing (the "Where you are" filter + the carousel's Start
-- here picks), so authenticated-read; per-stage counts join to content_items,
-- whose own RLS still restricts to published + channel-visible rows, so a
-- member's counts never include drafts or another company's content. Writes are
-- ntitt_admin only, mirroring the content spine and content_item_topics.
-- ============================================================================
create table public.content_item_stages (
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  stage text not null check (stage in ('start_here', 'in_it', 'rebuilding')),
  primary key (content_item_id, stage)
);

alter table public.content_item_stages enable row level security;

-- Reverse lookup (stage -> its items) for the per-stage count + filter queries.
create index content_item_stages_stage_idx on public.content_item_stages (stage);

-- ---- RLS: reads (member-facing, like content_item_topics) ------------------
create policy "authenticated read item stages"
  on public.content_item_stages for select
  using (auth.role() = 'authenticated');

-- ---- RLS: writes are ntitt_admin only (mirrors the content spine) ----------
create policy "ntitt admins create item stages"
  on public.content_item_stages for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins delete item stages"
  on public.content_item_stages for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));
