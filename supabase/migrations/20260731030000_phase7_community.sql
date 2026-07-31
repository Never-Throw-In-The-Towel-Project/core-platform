-- ============================================================================
-- PHASE 7 (2/2) — COMMUNITY: one shared, NTITT-wide community as the
-- primary space, with an optional company-only space alongside it, per the
-- resolved model in docs/ARCHITECTURE.md "Community scope". This is the
-- direct social expression of "Core platform vs. co-branded portals": the
-- community IS the core, shared experience; a company-only space is the
-- co-branded overlay on top of it -- not a fork, not per-company isolated
-- tables.
-- ============================================================================

create type public.community_scope as enum ('global', 'company');
create type public.community_board as enum ('feed', 'wins');

-- One shared table set, not per-company-isolated tables. `scope` is what
-- does the isolating: 'global' rows are readable by any authenticated user
-- platform-wide; 'company' rows only by the same company's own users --
-- same pattern as every other company-scoped table in this schema.
-- `board` distinguishes the main feed from the dedicated Wins Board (brief
-- section 8) -- structurally identical content (text + optional photo,
-- likes, comments, moderation), so one table rather than duplicating all
-- of the above for a second content type.
-- user_id/removed_by reference public.profiles(id), not auth.users(id):
-- profiles.id is itself a 1:1 FK onto auth.users(id) (see the Phase 1
-- migration), so this is semantically identical, but it's what lets
-- PostgREST embed the author's profile (display_name) directly in a
-- single query (`.select("*, author:profiles(display_name)")`) -- there's
-- no FK PostgREST can walk from these tables to profiles otherwise.
create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid not null references public.companies (id),  -- the author's company; only enforced when scope='company'
  scope public.community_scope not null default 'global',
  board public.community_board not null default 'feed',
  body text not null,
  -- Photo posts (brief section 8) are scoped down for this phase to a
  -- pasted image URL, not a real upload flow -- see docs/ARCHITECTURE.md
  -- "Community (Phase 7)" for why. The column is ready for a real upload
  -- pipeline (Supabase Storage) later without a further migration.
  image_url text,
  is_removed boolean not null default false,
  removed_by uuid references public.profiles (id),
  removed_at timestamptz,
  removal_reason text,
  created_at timestamptz not null default now()
);

alter table public.community_posts enable row level security;

create policy "read visible community posts"
  on public.community_posts for select
  using (
    not is_removed
    and (
      scope = 'global'
      or (
        scope = 'company'
        and company_id = (select p.company_id from public.profiles p where p.id = auth.uid())
      )
    )
  );

-- ntitt_admin's moderation queue needs to see reported/removed posts too --
-- a second, separate permissive SELECT policy (Postgres RLS ORs multiple
-- permissive policies together), not a modification of the one above.
create policy "ntitt admins read all community posts"
  on public.community_posts for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

-- Posting requires community_opt_in (set the first time someone accepts
-- the community guidelines -- see the (app)/community pages). No separate
-- "no anonymous posting" check is needed: profiles.display_name is already
-- NOT NULL at the schema level, so every author has one by construction.
create policy "users create their own community posts"
  on public.community_posts for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = community_posts.company_id
        and p.community_opt_in = true
    )
  );

-- No update policy for authenticated users at all -- posts are immutable
-- once created except for moderation. This is intentional: there is no
-- user-facing "delete my own post" feature in this phase (not asked for by
-- the brief), only the ntitt_admin moderation path below.
create policy "ntitt admins moderate community posts"
  on public.community_posts for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));


-- scope/company_id are denormalized from the parent post (set once at
-- insert, enforced by the submitting server action, not by a DB trigger --
-- comments never change parent, so this doesn't drift) so comment
-- visibility doesn't require a cross-table RLS join on every read.
create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  scope public.community_scope not null,
  company_id uuid not null references public.companies (id),
  body text not null,
  is_removed boolean not null default false,
  removed_by uuid references public.profiles (id),
  removed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.community_comments enable row level security;

create policy "read visible community comments"
  on public.community_comments for select
  using (
    not is_removed
    and (
      scope = 'global'
      or (
        scope = 'company'
        and company_id = (select p.company_id from public.profiles p where p.id = auth.uid())
      )
    )
  );

create policy "ntitt admins read all community comments"
  on public.community_comments for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "users create their own community comments"
  on public.community_comments for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.community_opt_in = true)
  );

create policy "ntitt admins moderate community comments"
  on public.community_comments for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));


create table public.community_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table public.community_likes enable row level security;

-- Likes aren't scoped by company/global -- if you can already see the post
-- (enforced when fetching it), seeing who else liked it isn't a privacy
-- boundary. A like on a post you can't otherwise see just won't be joined
-- to anything visible in practice.
create policy "authenticated users read community likes"
  on public.community_likes for select
  using (auth.role() = 'authenticated');

create policy "users like posts as themselves"
  on public.community_likes for insert
  with check (auth.uid() = user_id);

create policy "users unlike their own like"
  on public.community_likes for delete
  using (auth.uid() = user_id);


-- "Report button on every post" (brief) + "basic moderation tools for the
-- NTITT admin... so flagged posts can be reviewed and removed quickly."
create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  reporter_user_id uuid not null references public.profiles (id) on delete cascade,
  reason text,
  resolved boolean not null default false,
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.community_reports enable row level security;

create policy "users report posts"
  on public.community_reports for insert
  with check (auth.uid() = reporter_user_id);

create policy "ntitt admins read community reports"
  on public.community_reports for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

create policy "ntitt admins resolve community reports"
  on public.community_reports for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ntitt_admin'));

-- Deliberately no policy anywhere in this file references role = 'hr_admin'.
-- That is intentional, not an oversight -- see docs/ARCHITECTURE.md
-- "Community scope": moderation is Anthony's/NTITT's remit, never a
-- client's.
