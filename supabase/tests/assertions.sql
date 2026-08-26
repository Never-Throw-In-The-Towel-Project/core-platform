-- ============================================================================
-- Post-apply assertions for the migration validation harness
-- (validate_migrations.sh). Runs after the stub + every migration + seed have
-- applied. Every check RAISES on violation so `psql -v ON_ERROR_STOP=1` makes
-- the whole run exit non-zero -- this file is a regression guard, not just a
-- report. Notices mark each passing invariant.
--
-- Coverage is the privacy/security boundary the platform depends on: RLS on
-- every table, plus the four hardening/correctness migrations from the
-- 2026-08-10 review (handle_new_user role trust, comment scope binding,
-- companies contact-PII column grants, community report dedup).
-- ============================================================================

-- ---- 1. RLS enabled on every public/private table --------------------------
do $$
declare missing int; total int;
begin
  select count(*) into missing from pg_tables
    where schemaname in ('public','private') and not rowsecurity;
  if missing <> 0 then
    raise exception 'RLS disabled on % public/private table(s)', missing;
  end if;
  select count(*) into total from pg_tables where schemaname in ('public','private');
  if total <> 41 then
    raise exception 'expected 41 public+private tables (26+15), found %', total;
  end if;
  raise notice 'PASS  1  RLS enabled on all % public/private tables', total;
end
$$;

-- ---- 2a. handle_new_user must never trust client role/company (CRITICAL) ---
do $$
declare got_role public.user_role; got_company uuid; got_name text;
begin
  insert into auth.users (id, email, raw_user_meta_data) values (
    '11111111-1111-1111-1111-111111111111', 'attacker@evil.test',
    '{"role":"ntitt_admin","company_id":"00000000-0000-0000-0000-000000000002","display_name":"mallory"}'::jsonb
  );
  select role, company_id, display_name into got_role, got_company, got_name
    from public.profiles where id = '11111111-1111-1111-1111-111111111111';
  if got_role <> 'employee' then
    raise exception 'handle_new_user trusted client-supplied role: got %', got_role;
  end if;
  if got_company <> '00000000-0000-0000-0000-000000000001' then
    raise exception 'handle_new_user trusted client-supplied company_id: got %', got_company;
  end if;
  if got_name <> 'mallory' then
    raise exception 'handle_new_user dropped the display_name: got %', got_name;
  end if;
  raise notice 'PASS  2a handle_new_user ignores client role/company (plain employee in NTITT Direct)';
end
$$;

-- ---- 2b. comment INSERT policy binds scope+company to the parent post -------
do $$
declare wc text;
begin
  select pg_get_expr(polwithcheck, polrelid) into wc
    from pg_policy where polrelid = 'public.community_comments'::regclass and polcmd = 'a';
  if wc is null then raise exception 'no INSERT policy on community_comments'; end if;
  if position('community_posts' in wc) = 0 then
    raise exception 'comment INSERT policy does not reference the parent post: %', wc;
  end if;
  raise notice 'PASS  2b community_comments INSERT policy binds to the parent post';
end
$$;

-- ---- 2c. companies contact-PII columns hidden from anon/authenticated -------
do $$
begin
  if not has_column_privilege('anon','public.companies','name','select') then
    raise exception 'anon lost SELECT on companies.name (branding column)';
  end if;
  if has_column_privilege('anon','public.companies','support_contact_phone','select')
     or has_column_privilege('anon','public.companies','support_contact_email','select') then
    raise exception 'anon can still read companies support_contact PII';
  end if;
  if not has_column_privilege('authenticated','public.companies','logo_url','select') then
    raise exception 'authenticated lost SELECT on companies.logo_url (branding column)';
  end if;
  if has_column_privilege('authenticated','public.companies','support_contact_name','select') then
    raise exception 'authenticated can still read companies.support_contact_name PII';
  end if;
  raise notice 'PASS  2c companies contact-PII columns revoked from anon/authenticated, branding kept';
end
$$;

-- ---- 2c2. profiles privilege columns not writable by the session client -----
-- (20260814100000) role/company_id must never be UPDATE-able by anon/
-- authenticated, or a user self-escalates to ntitt_admin / hops tenants; the
-- self-service columns must stay writable or onboarding/settings break.
do $$
begin
  if has_column_privilege('authenticated','public.profiles','role','update') then
    raise exception 'authenticated can UPDATE profiles.role (privilege escalation)';
  end if;
  if has_column_privilege('authenticated','public.profiles','company_id','update') then
    raise exception 'authenticated can UPDATE profiles.company_id (tenant hop)';
  end if;
  if has_column_privilege('anon','public.profiles','role','update') then
    raise exception 'anon can UPDATE profiles.role';
  end if;
  if not has_column_privilege('authenticated','public.profiles','display_name','update') then
    raise exception 'authenticated lost UPDATE on profiles.display_name (breaks settings/onboarding)';
  end if;
  if not has_column_privilege('authenticated','public.profiles','onboarding_completed','update') then
    raise exception 'authenticated lost UPDATE on profiles.onboarding_completed (breaks onboarding)';
  end if;
  raise notice 'PASS  2c2 profiles role/company_id UPDATE revoked; self-service columns kept';
end
$$;

-- ---- 2d. community_reports dedup: unique(post_id, reporter_user_id) ---------
do $$
declare def text;
begin
  select pg_get_constraintdef(oid) into def from pg_constraint
    where conrelid = 'public.community_reports'::regclass
      and contype = 'u' and conname = 'community_reports_post_reporter_unique';
  if def is null then raise exception 'missing community_reports dedup unique constraint'; end if;
  if def <> 'UNIQUE (post_id, reporter_user_id)' then
    raise exception 'unexpected dedup constraint definition: %', def;
  end if;
  raise notice 'PASS  2d community_reports has %', def;
end
$$;

-- ---- 2e. community_comments threading column (self-referential FK) ----------
do $$
declare has_col boolean; nfk int;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='community_comments' and column_name='parent_comment_id'
  ) into has_col;
  if not has_col then raise exception 'community_comments.parent_comment_id missing (threading)'; end if;
  select count(*) into nfk from pg_constraint
    where conrelid = 'public.community_comments'::regclass and contype = 'f'
      and confrelid = 'public.community_comments'::regclass;
  if nfk < 1 then raise exception 'community_comments has no self-referential FK for threading'; end if;
  raise notice 'PASS  2e community_comments.parent_comment_id present + self-referential FK';
end
$$;

-- ---- 3. photo-upload storage bucket + policies applied ----------------------
do $$
declare npol int; is_public boolean;
begin
  select public into is_public from storage.buckets where id = 'community-images';
  if is_public is distinct from true then
    raise exception 'community-images bucket missing or not public';
  end if;
  select count(*) into npol from pg_policy where polrelid = 'storage.objects'::regclass;
  if npol < 3 then raise exception 'expected >= 3 storage.objects policies, found %', npol; end if;
  raise notice 'PASS  3  community-images bucket + % storage.objects policies', npol;
end
$$;

-- ---- 4. content spine: ntitt_admin-only writes + content-assets bucket ------
do $$
declare wc text; is_public boolean;
begin
  select pg_get_expr(polwithcheck, polrelid) into wc
    from pg_policy where polrelid = 'public.content_items'::regclass and polcmd = 'a';
  if wc is null then raise exception 'no INSERT policy on content_items'; end if;
  if position('ntitt_admin' in wc) = 0 then
    raise exception 'content_items INSERT policy is not ntitt_admin gated: %', wc;
  end if;
  select public into is_public from storage.buckets where id = 'content-assets';
  if is_public is distinct from true then
    raise exception 'content-assets bucket missing or not public';
  end if;
  raise notice 'PASS  4  content_items writes ntitt_admin-gated; content-assets bucket public';
end
$$;

-- ---- 4f. Brain folders: ntitt_admin-only + content_items.folder_id (set null) --
do $$
declare sc text; has_col boolean; ondelete char;
begin
  -- Folders are ntitt_admin-only for READS too (internal Brain organiser), so
  -- the SELECT policy must be ntitt_admin-gated -- unlike content_items, which
  -- authenticated members read when published.
  select pg_get_expr(polqual, polrelid) into sc
    from pg_policy where polrelid = 'public.content_folders'::regclass and polcmd = 'r';
  if sc is null then raise exception 'no SELECT policy on content_folders'; end if;
  if position('ntitt_admin' in sc) = 0 then
    raise exception 'content_folders SELECT policy is not ntitt_admin gated: %', sc;
  end if;

  -- content_items.folder_id exists and un-files (SET NULL) on folder delete, so
  -- deleting a folder never deletes content.
  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='content_items' and column_name='folder_id'
  ) into has_col;
  if not has_col then raise exception 'content_items.folder_id missing (Brain folders)'; end if;
  select confdeltype into ondelete from pg_constraint
    where conrelid = 'public.content_items'::regclass and contype = 'f'
      and confrelid = 'public.content_folders'::regclass;
  if ondelete is distinct from 'n' then
    raise exception 'content_items.folder_id FK is not ON DELETE SET NULL (got %)', ondelete;
  end if;
  raise notice 'PASS  4f content_folders ntitt_admin-only; content_items.folder_id present + ON DELETE SET NULL';
end
$$;

-- ---- 4g. distribution calendar: content_items.scheduled_for (nullable date) --
do $$
declare col_type text; col_nullable text;
begin
  select data_type, is_nullable into col_type, col_nullable
    from information_schema.columns
    where table_schema = 'public' and table_name = 'content_items' and column_name = 'scheduled_for';
  if col_type is null then raise exception 'content_items.scheduled_for missing (distribution calendar)'; end if;
  if col_type <> 'date' then raise exception 'content_items.scheduled_for is % (expected date)', col_type; end if;
  if col_nullable <> 'YES' then raise exception 'content_items.scheduled_for must be nullable'; end if;
  raise notice 'PASS  4g content_items.scheduled_for present, date, nullable';
end
$$;

-- ---- 5. challenges: ntitt_admin-only writes; participation is private -------
do $$
declare wc text; enroll_rls boolean;
begin
  select pg_get_expr(polwithcheck, polrelid) into wc
    from pg_policy where polrelid = 'public.challenges'::regclass and polcmd = 'a';
  if wc is null then raise exception 'no INSERT policy on challenges'; end if;
  if position('ntitt_admin' in wc) = 0 then
    raise exception 'challenges INSERT policy is not ntitt_admin gated: %', wc;
  end if;
  -- Participation tables must live in `private` with RLS on (own-rows boundary).
  select rowsecurity into enroll_rls from pg_tables
    where schemaname = 'private' and tablename = 'challenge_enrollments';
  if enroll_rls is distinct from true then
    raise exception 'challenge_enrollments is not an RLS-protected private table';
  end if;
  raise notice 'PASS  5  challenges writes ntitt_admin-gated; enrollments private + RLS on';
end
$$;

-- ---- 5c. company step challenge: HR-gated writes, invited-clients-only, ------
--         private opt-ins, service-role-only aggregate.
do $$
declare wc text; ndirect int; nwrite int; optin_rls boolean;
begin
  select pg_get_expr(polwithcheck, polrelid) into wc
    from pg_policy where polrelid = 'public.company_step_challenges'::regclass and polcmd = 'a';
  if wc is null then raise exception 'no INSERT policy on company_step_challenges'; end if;
  if position('hr_admin' in wc) = 0 then
    raise exception 'company_step_challenges INSERT policy is not hr_admin gated: %', wc;
  end if;

  -- Invited clients only: a CHECK bars the shared self-signup pool id.
  select count(*) into ndirect from pg_constraint
    where conrelid = 'public.company_step_challenges'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%00000000-0000-0000-0000-000000000001%';
  if ndirect < 1 then
    raise exception 'company_step_challenges has no CHECK barring the shared self-signup pool';
  end if;

  -- The aggregate is service-role-write-only: no insert/update/delete policy.
  select count(*) into nwrite from pg_policy
    where polrelid = 'public.company_step_totals'::regclass and polcmd in ('a','w','d');
  if nwrite <> 0 then
    raise exception 'company_step_totals has % authenticated write policy(ies) -- must be service-role only', nwrite;
  end if;

  -- Opt-ins are a private, RLS-protected own-rows table.
  select rowsecurity into optin_rls from pg_tables
    where schemaname = 'private' and tablename = 'company_step_challenge_optins';
  if optin_rls is distinct from true then
    raise exception 'company_step_challenge_optins is not an RLS-protected private table';
  end if;

  raise notice 'PASS  5c company step challenge: HR-gated writes, invited-clients-only CHECK, aggregate service-role-only, opt-ins private+RLS';
end
$$;

-- ---- 5d. events: ntitt_admin-only writes; anon reads only published GLOBAL; --
--          bookings have NO member insert policy (writes go via the functions).
do $$
declare wc text; anon_read text; nins int;
begin
  -- writes gated to ntitt_admin
  select pg_get_expr(polwithcheck, polrelid) into wc
    from pg_policy where polrelid = 'public.events'::regclass and polcmd = 'a';
  if wc is null then raise exception 'no INSERT policy on events'; end if;
  if position('ntitt_admin' in wc) = 0 then
    raise exception 'events INSERT policy is not ntitt_admin gated: %', wc;
  end if;

  -- the public read policy must be scoped to published AND global (company_id null),
  -- so anon can never be shown a company-scoped or draft event.
  select pg_get_expr(polqual, polrelid) into anon_read
    from pg_policy where polrelid = 'public.events'::regclass
      and polname = 'public read published global events';
  if anon_read is null then raise exception 'missing public events read policy'; end if;
  if position('company_id' in anon_read) = 0 or position('is_published' in anon_read) = 0 then
    raise exception 'public events read policy not scoped to published+global: %', anon_read;
  end if;
  if not has_table_privilege('anon','public.events','select') then
    raise exception 'anon lacks SELECT grant on events (marketing surface)';
  end if;
  if has_table_privilege('anon','public.event_bookings','select') then
    raise exception 'anon can read event_bookings (must be private to members/admin)';
  end if;

  -- event_bookings must have NO INSERT policy at all: every write goes through
  -- book_event()/cancel_my_booking(), so a direct insert can't bypass capacity.
  select count(*) into nins from pg_policy
    where polrelid = 'public.event_bookings'::regclass and polcmd = 'a';
  if nins <> 0 then
    raise exception 'event_bookings has % INSERT policy(ies) -- bookings must only be written via book_event()', nins;
  end if;

  raise notice 'PASS  5d events: ntitt_admin-gated writes, anon reads published-global only, bookings function-only';
end
$$;

-- ============================================================================
-- LIVE RLS test of the comment-scope fix, run as the `authenticated` role with
-- a simulated JWT sub -- what PostgREST sets up per request. Fixtures are
-- created as the bootstrap superuser (which bypasses RLS).
-- ============================================================================
insert into public.companies (id, name, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001','Company A','company-a'),
  ('bbbbbbbb-0000-0000-0000-000000000002','Company B','company-b');

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-00000000000a','usera@a.test','{"display_name":"usera"}'::jsonb),
  ('b0000000-0000-0000-0000-00000000000b','userb@b.test','{"display_name":"userb"}'::jsonb);
update public.profiles set company_id='aaaaaaaa-0000-0000-0000-000000000001', community_opt_in=true
  where id='a0000000-0000-0000-0000-00000000000a';
update public.profiles set company_id='bbbbbbbb-0000-0000-0000-000000000002', community_opt_in=true
  where id='b0000000-0000-0000-0000-00000000000b';

insert into public.community_posts (id, user_id, company_id, scope, body) values
  ('cc000000-0000-0000-0000-0000000000a1','a0000000-0000-0000-0000-00000000000a',
   'aaaaaaaa-0000-0000-0000-000000000001','global','global post');

-- Supabase's project setup grants the authenticated role table privileges on
-- public tables; replicate that so RLS -- not a missing grant -- is the gate.
grant select, insert on public.community_comments to authenticated;
grant select on public.community_posts to authenticated;
grant select on public.profiles to authenticated;

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
set role authenticated;

do $$
begin
  -- TEST 1 (must be BLOCKED): mislabel scope=company on a GLOBAL post
  begin
    insert into public.community_comments (post_id, user_id, scope, company_id, body)
    values ('cc000000-0000-0000-0000-0000000000a1','a0000000-0000-0000-0000-00000000000a',
            'company','bbbbbbbb-0000-0000-0000-000000000002','injected company label');
    raise exception 'FAIL comment-scope: mislabeled scope=company was allowed';
  exception when insufficient_privilege then null;
  end;

  -- TEST 2 (must be BLOCKED): scope=global but company_id != parent's
  begin
    insert into public.community_comments (post_id, user_id, scope, company_id, body)
    values ('cc000000-0000-0000-0000-0000000000a1','a0000000-0000-0000-0000-00000000000a',
            'global','bbbbbbbb-0000-0000-0000-000000000002','mismatched company_id');
    raise exception 'FAIL comment-scope: mismatched company_id was allowed';
  exception when insufficient_privilege then null;
  end;

  -- TEST 3 (must be ALLOWED): legit comment matching the parent exactly
  begin
    insert into public.community_comments (post_id, user_id, scope, company_id, body)
    values ('cc000000-0000-0000-0000-0000000000a1','a0000000-0000-0000-0000-00000000000a',
            'global','aaaaaaaa-0000-0000-0000-000000000001','legitimate global reply');
  exception when insufficient_privilege then
    raise exception 'FAIL comment-scope: a legitimate matching comment was blocked';
  end;

  raise notice 'PASS  2b* live RLS: cross-label comment injection blocked, legit comment allowed';
end
$$;

reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ---- threading: a reply inherits the parent-POST scope binding --------------
-- Adding parent_comment_id must not open a hole: a reply is still bound to its
-- post's scope/company by the same hardened INSERT policy. A known-id top-level
-- comment (created as the bootstrap superuser) is the reply target.
insert into public.community_comments (id, post_id, user_id, scope, company_id, body) values
  ('dd000000-0000-0000-0000-0000000000c1','cc000000-0000-0000-0000-0000000000a1',
   'a0000000-0000-0000-0000-00000000000a','global','aaaaaaaa-0000-0000-0000-000000000001','parent comment');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$
begin
  -- TEST 1 (must be ALLOWED): a legit reply -- parent set, scope/company match the post
  begin
    insert into public.community_comments (post_id, user_id, scope, company_id, body, parent_comment_id)
    values ('cc000000-0000-0000-0000-0000000000a1','a0000000-0000-0000-0000-00000000000a',
            'global','aaaaaaaa-0000-0000-0000-000000000001','legit reply','dd000000-0000-0000-0000-0000000000c1');
  exception when insufficient_privilege then
    raise exception 'FAIL threading: a legitimate reply was blocked';
  end;

  -- TEST 2 (must be BLOCKED): a reply mislabeling scope=company on the GLOBAL post
  begin
    insert into public.community_comments (post_id, user_id, scope, company_id, body, parent_comment_id)
    values ('cc000000-0000-0000-0000-0000000000a1','a0000000-0000-0000-0000-00000000000a',
            'company','bbbbbbbb-0000-0000-0000-000000000002','sneaky reply','dd000000-0000-0000-0000-0000000000c1');
    raise exception 'FAIL threading: a mislabeled-scope reply was allowed';
  exception when insufficient_privilege then null;
  end;

  raise notice 'PASS  2e* live: replies inherit the parent-post scope binding (legit allowed, mislabeled blocked)';
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ---- dedup constraint fires on a genuine duplicate (behavioral) ------------
do $$
begin
  insert into public.community_reports (post_id, reporter_user_id, reason)
    values ('cc000000-0000-0000-0000-0000000000a1','b0000000-0000-0000-0000-00000000000b','first');
  begin
    insert into public.community_reports (post_id, reporter_user_id, reason)
      values ('cc000000-0000-0000-0000-0000000000a1','b0000000-0000-0000-0000-00000000000b','dup');
    raise exception 'FAIL dedup: a duplicate (post,reporter) report was accepted';
  exception when unique_violation then null;
  end;
  raise notice 'PASS  2d* live: duplicate report raises unique_violation (idempotent no-op precondition)';
end
$$;

-- ============================================================================
-- LIVE RLS test of the content spine: ntitt_admin-only writes + channel
-- placement visibility. Fixtures created as the bootstrap superuser (which
-- bypasses RLS); reuses Company A / usera from the community fixtures above.
-- ============================================================================
insert into auth.users (id, email, raw_user_meta_data) values
  ('ee000000-0000-0000-0000-0000000000ad','admin@ntitt.test','{"display_name":"admin"}'::jsonb);
update public.profiles set role='ntitt_admin', company_id='aaaaaaaa-0000-0000-0000-000000000001'
  where id='ee000000-0000-0000-0000-0000000000ad';

-- One global published item (no placement) and one placed only on Company B.
insert into public.content_items (id, type, title, category, vimeo_id, is_published) values
  ('ef000000-0000-0000-0000-0000000000f1','video','Global item','mental_fitness','vimeo-global',true),
  ('ef000000-0000-0000-0000-0000000000f2','video','Company B item','mental_fitness','vimeo-b',true);
insert into public.content_channel_placements (content_item_id, company_id) values
  ('ef000000-0000-0000-0000-0000000000f2','bbbbbbbb-0000-0000-0000-000000000002');

-- Replicate Supabase's default public-schema grants so RLS -- not a missing
-- grant -- is the gate (same as the community block above).
grant select, insert on public.content_items to authenticated;
grant select, insert on public.content_channel_placements to authenticated;

-- ---- as usera (Company A, NOT an admin) ----
-- Set both JWT claims PostgREST provides per request: `sub` (feeds auth.uid())
-- and `role` (feeds auth.role(), which the content read policy checks).
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
do $$
declare visible int;
begin
  -- TEST 1 (must be BLOCKED): a non-admin cannot insert content
  begin
    insert into public.content_items (type, title, category, vimeo_id, is_published)
    values ('video','sneaky','mental_fitness','x',true);
    raise exception 'FAIL content-write: a non-admin was allowed to insert content';
  exception when insufficient_privilege then null;
  end;

  -- TEST 2 (must be VISIBLE): a global published item
  select count(*) into visible from public.content_items
    where id = 'ef000000-0000-0000-0000-0000000000f1';
  if visible <> 1 then raise exception 'FAIL content-read: global published item not visible to a member'; end if;

  -- TEST 3 (must be HIDDEN): an item placed only on Company B, seen by Company A
  select count(*) into visible from public.content_items
    where id = 'ef000000-0000-0000-0000-0000000000f2';
  if visible <> 0 then raise exception 'FAIL content-read: a Company-B-placed item leaked to Company A'; end if;

  raise notice 'PASS  4a* live: non-admin insert blocked; channel placement scopes visibility';
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);

-- ---- as the ntitt_admin: the write must succeed ----
select set_config('request.jwt.claim.sub', 'ee000000-0000-0000-0000-0000000000ad', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
do $$
begin
  begin
    insert into public.content_items (type, title, category, vimeo_id, is_published, created_by)
    values ('video','admin upload','mental_fitness','vimeo-admin',true,'ee000000-0000-0000-0000-0000000000ad');
  exception when insufficient_privilege then
    raise exception 'FAIL content-write: an ntitt_admin was blocked from inserting content';
  end;
  raise notice 'PASS  4b* live: ntitt_admin insert allowed';
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);

-- ============================================================================
-- LIVE RLS test of challenges: ntitt_admin-only definition writes, published
-- visibility, and PRIVATE participation (a member enrols only themselves and
-- never sees another member's enrollment). Reuses usera / userb / the admin and
-- the global content item ef…f1 from the fixtures above.
-- ============================================================================
insert into public.challenges (id, title, category, length_days, is_published) values
  ('caa00000-0000-0000-0000-0000000000c1','Published challenge','mental_fitness',28,true),
  ('caa00000-0000-0000-0000-0000000000c2','Draft challenge','mental_fitness',28,false);
insert into public.challenge_days (id, challenge_id, day_index, content_item_id) values
  ('cda00000-0000-0000-0000-0000000000d1','caa00000-0000-0000-0000-0000000000c1',1,'ef000000-0000-0000-0000-0000000000f1');
-- userb enrols in the published challenge (as the bootstrap superuser, bypassing
-- RLS) so we can prove usera can't see it.
insert into private.challenge_enrollments (user_id, challenge_id) values
  ('b0000000-0000-0000-0000-00000000000b','caa00000-0000-0000-0000-0000000000c1');

-- Replicate Supabase's default public-schema grants (private grants come from
-- the challenges migration itself) so RLS -- not a missing grant -- is the gate.
grant select, insert on public.challenges to authenticated;
grant select on public.challenge_days to authenticated;

-- ---- as usera (Company A, NOT an admin) ----
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
do $$
declare visible int;
begin
  -- TEST 1 (must be BLOCKED): a non-admin cannot author a challenge
  begin
    insert into public.challenges (title, category, length_days, is_published)
    values ('sneaky','mental_fitness',7,true);
    raise exception 'FAIL challenge-write: a non-admin was allowed to create a challenge';
  exception when insufficient_privilege then null;
  end;

  -- TEST 2 (must be VISIBLE / HIDDEN): published seen, draft hidden
  select count(*) into visible from public.challenges where id = 'caa00000-0000-0000-0000-0000000000c1';
  if visible <> 1 then raise exception 'FAIL challenge-read: published challenge not visible to a member'; end if;
  select count(*) into visible from public.challenges where id = 'caa00000-0000-0000-0000-0000000000c2';
  if visible <> 0 then raise exception 'FAIL challenge-read: a draft challenge leaked to a member'; end if;

  -- TEST 3 (must be BLOCKED): enrolling someone else
  begin
    insert into private.challenge_enrollments (user_id, challenge_id)
    values ('b0000000-0000-0000-0000-00000000000b','caa00000-0000-0000-0000-0000000000c1');
    raise exception 'FAIL enrollment-write: a member enrolled another user';
  exception when insufficient_privilege then null;
  end;

  -- TEST 4 (must be ALLOWED): enrolling yourself + marking your own day done
  begin
    insert into private.challenge_enrollments (user_id, challenge_id)
    values ('a0000000-0000-0000-0000-00000000000a','caa00000-0000-0000-0000-0000000000c1');
    insert into private.challenge_day_completions (user_id, challenge_day_id, challenge_id)
    values ('a0000000-0000-0000-0000-00000000000a','cda00000-0000-0000-0000-0000000000d1','caa00000-0000-0000-0000-0000000000c1');
  exception when insufficient_privilege then
    raise exception 'FAIL participation-write: a member was blocked from enrolling/completing their own';
  end;

  -- TEST 5 (must be ISOLATED): usera sees only their own enrollment, never userb's
  select count(*) into visible from private.challenge_enrollments;
  if visible <> 1 then
    raise exception 'FAIL participation-read: expected usera to see exactly 1 (own) enrollment, saw %', visible;
  end if;

  raise notice 'PASS  5* live: non-admin challenge write blocked; draft hidden; participation private + self-only';
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);

-- ---- as the ntitt_admin: authoring a challenge must succeed ----
select set_config('request.jwt.claim.sub', 'ee000000-0000-0000-0000-0000000000ad', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
do $$
begin
  begin
    insert into public.challenges (title, category, length_days, is_published, created_by)
    values ('admin challenge','mental_fitness',30,true,'ee000000-0000-0000-0000-0000000000ad');
  exception when insufficient_privilege then
    raise exception 'FAIL challenge-write: an ntitt_admin was blocked from creating a challenge';
  end;
  raise notice 'PASS  5** live: ntitt_admin challenge authoring allowed';
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);

-- ============================================================================
-- LIVE RLS test of step_entries (Track 2 · D2): a member reads and writes ONLY
-- their own steps -- private and never-reportable, exactly like sleep/day
-- rating. Reuses usera (Company A) / userb (Company B) from the fixtures above.
-- ============================================================================
-- userb logs steps as the bootstrap superuser (bypassing RLS) so we can prove
-- usera can neither see them nor write them.
insert into private.step_entries (user_id, entry_date, steps) values
  ('b0000000-0000-0000-0000-00000000000b', '2026-08-13', 6000);

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$
declare visible int;
begin
  -- TEST 1 (must be BLOCKED): logging steps as another user
  begin
    insert into private.step_entries (user_id, entry_date, steps)
    values ('b0000000-0000-0000-0000-00000000000b', '2026-08-12', 1234);
    raise exception 'FAIL steps-write: a member logged steps for another user';
  exception when insufficient_privilege then null;
  end;

  -- TEST 2 (must be ALLOWED): logging your own steps
  begin
    insert into private.step_entries (user_id, entry_date, steps)
    values ('a0000000-0000-0000-0000-00000000000a', '2026-08-13', 9000);
  exception when insufficient_privilege then
    raise exception 'FAIL steps-write: a member was blocked from logging their own steps';
  end;

  -- TEST 3 (must be ISOLATED): usera sees only their own row, never userb's
  select count(*) into visible from private.step_entries;
  if visible <> 1 then
    raise exception 'FAIL steps-read: expected usera to see exactly 1 (own) step row, saw %', visible;
  end if;

  raise notice 'PASS  6* live: step_entries own-rows-only (self-write allowed, cross-user blocked + isolated)';
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ============================================================================
-- LIVE RLS test of the CLEAN STREAK tables (habit_challenges + habit_check_ins):
-- a member creates + marks ONLY their own recovery journey -- private and never
-- visible to anyone else, exactly like step_entries. Reuses usera / userb.
-- ============================================================================
-- userb creates a challenge + a check-in as the bootstrap superuser (bypassing
-- RLS) so we can prove usera can neither see nor write them.
insert into private.habit_challenges (id, user_id, habit_label, target_days, started_on) values
  ('11ab0000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 'no smoking', 30, '2026-08-13');
insert into private.habit_check_ins (user_id, habit_challenge_id, check_in_date, outcome) values
  ('b0000000-0000-0000-0000-00000000000b', '11ab0000-0000-0000-0000-0000000000b1', '2026-08-13', 'success');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$
declare visible int; my_challenge uuid;
begin
  -- TEST 1 (must be BLOCKED): creating a challenge as another user
  begin
    insert into private.habit_challenges (user_id, habit_label, target_days, started_on)
    values ('b0000000-0000-0000-0000-00000000000b', 'no gambling', 7, '2026-08-13');
    raise exception 'FAIL habit-write: a member created a challenge for another user';
  exception when insufficient_privilege then null;
  end;

  -- TEST 2 (must be ISOLATED): usera cannot see userb's challenge or check-in
  select count(*) into visible from private.habit_challenges;
  if visible <> 0 then raise exception 'FAIL habit-read: another user''s challenge leaked (saw %)', visible; end if;
  select count(*) into visible from private.habit_check_ins;
  if visible <> 0 then raise exception 'FAIL habit-read: another user''s check-in leaked (saw %)', visible; end if;

  -- TEST 3 (must be ALLOWED): usera creates their OWN challenge + marks a clean day
  insert into private.habit_challenges (user_id, habit_label, target_days, started_on)
    values ('a0000000-0000-0000-0000-00000000000a', 'no smoking', 7, '2026-08-13')
    returning id into my_challenge;
  insert into private.habit_check_ins (user_id, habit_challenge_id, check_in_date, outcome)
    values ('a0000000-0000-0000-0000-00000000000a', my_challenge, '2026-08-13', 'success');

  -- TEST 4 (must be ISOLATED): usera now sees exactly their own 1 challenge + 1 check-in
  select count(*) into visible from private.habit_challenges;
  if visible <> 1 then raise exception 'FAIL habit-read: expected usera to see exactly 1 (own) challenge, saw %', visible; end if;
  select count(*) into visible from private.habit_check_ins;
  if visible <> 1 then raise exception 'FAIL habit-read: expected usera to see exactly 1 (own) check-in, saw %', visible; end if;

  raise notice 'PASS  6c* live: clean-streak tables own-rows-only (self-write allowed, cross-user blocked + isolated)';
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ============================================================================
-- LIVE RLS test of stand_entries (STAND daily fundamentals): a member reads +
-- writes ONLY their own day's fundamentals -- private and never visible to
-- anyone else, exactly like the morning/night routines. Reuses usera / userb.
-- ============================================================================
-- userb's stand entry, seeded as the bootstrap superuser (bypassing RLS).
insert into private.stand_entries (user_id, entry_date, hydration, strength_of_connection) values
  ('b0000000-0000-0000-0000-00000000000b', '2026-08-13', true, 'called my brother');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$
declare visible int;
begin
  -- TEST 1 (must be BLOCKED): writing a stand entry as another user
  begin
    insert into private.stand_entries (user_id, entry_date, hydration)
    values ('b0000000-0000-0000-0000-00000000000b', '2026-08-14', true);
    raise exception 'FAIL stand-write: a member wrote a stand entry for another user';
  exception when insufficient_privilege then null;
  end;

  -- TEST 2 (must be ISOLATED): usera cannot see userb's stand entry
  select count(*) into visible from private.stand_entries;
  if visible <> 0 then raise exception 'FAIL stand-read: another user''s stand entry leaked (saw %)', visible; end if;

  -- TEST 3 (must be ALLOWED): usera writes their OWN day's fundamentals
  insert into private.stand_entries (user_id, entry_date, hydration, healthy_food, do_good_for_others)
    values ('a0000000-0000-0000-0000-00000000000a', '2026-08-13', true, true, 'helped a neighbour');

  -- TEST 4 (must be ISOLATED): usera now sees exactly their own 1 entry
  select count(*) into visible from private.stand_entries;
  if visible <> 1 then raise exception 'FAIL stand-read: expected usera to see exactly 1 (own) stand entry, saw %', visible; end if;

  raise notice 'PASS  6d* live: stand_entries own-rows-only (self-write allowed, cross-user blocked + isolated)';
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ============================================================================
-- LIVE RLS test of earned_badges (Track 2 · D2): a member reads and awards ONLY
-- their own badges, and a badge cannot be revoked (no update/delete policy).
-- Reuses usera / userb from the fixtures above.
-- ============================================================================
insert into private.earned_badges (user_id, badge_key) values
  ('b0000000-0000-0000-0000-00000000000b', 'first_week');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$
declare visible int;
begin
  -- TEST 1 (must be BLOCKED): awarding a badge to another user
  begin
    insert into private.earned_badges (user_id, badge_key)
    values ('b0000000-0000-0000-0000-00000000000b', 'ten_days');
    raise exception 'FAIL badges-write: a member awarded a badge to another user';
  exception when insufficient_privilege then null;
  end;

  -- TEST 2 (must be ALLOWED): awarding your own badge
  begin
    insert into private.earned_badges (user_id, badge_key)
    values ('a0000000-0000-0000-0000-00000000000a', 'first_week');
  exception when insufficient_privilege then
    raise exception 'FAIL badges-write: a member was blocked from earning their own badge';
  end;

  -- TEST 3 (must be REVOKE-PROOF): no delete policy -> a member cannot remove a badge
  begin
    delete from private.earned_badges where user_id = 'a0000000-0000-0000-0000-00000000000a';
    -- RLS with no DELETE policy makes the row invisible to the delete, so it
    -- affects 0 rows rather than erroring; assert the badge is still there.
  exception when insufficient_privilege then null;
  end;

  -- TEST 4 (must be ISOLATED + intact): usera sees only their own badge
  select count(*) into visible from private.earned_badges;
  if visible <> 1 then
    raise exception 'FAIL badges-read: expected usera to see exactly 1 (own) badge, saw %', visible;
  end if;

  raise notice 'PASS  6b* live: earned_badges own-rows-only, cross-user award blocked, revoke-proof';
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ============================================================================
-- LIVE RLS test of the COMPANY STEP CHALLENGE (Track 2 · D2, brief §2): a
-- company only ever sees an AGGREGATE. An employee can't author a challenge or
-- write the team total; drafts + other companies' challenges are hidden; opt-in
-- is own-rows-only and private; HR reads/writes ONLY their own company; and the
-- shared self-signup pool can never host a challenge. Reuses Company A/B and
-- usera (Company A) / userb (Company B) from the fixtures above.
-- ============================================================================
-- HR admin for Company A (created as an employee by the trigger, then promoted).
insert into auth.users (id, email, raw_user_meta_data) values
  ('40000000-0000-0000-0000-00000000000a','hra@a.test','{"display_name":"hra"}'::jsonb);
update public.profiles set role='hr_admin', company_id='aaaaaaaa-0000-0000-0000-000000000001'
  where id='40000000-0000-0000-0000-00000000000a';

-- Active + draft challenge on Company A, an active one on Company B, and an
-- aggregate row for Company A's active challenge.
insert into public.company_step_challenges
  (id, company_id, title, target_steps, reward_type, reward_name, starts_on, ends_on, status) values
  ('5c000000-0000-0000-0000-0000000000c1','aaaaaaaa-0000-0000-0000-000000000001',
   'October Steps',50000000,'team_experience','Team lunch','2026-10-01','2026-10-31','active'),
  ('5c000000-0000-0000-0000-0000000000c2','aaaaaaaa-0000-0000-0000-000000000001',
   'Draft',1000,'prize_draw','Vouchers','2026-11-01','2026-11-30','draft'),
  ('5c000000-0000-0000-0000-0000000000b1','bbbbbbbb-0000-0000-0000-000000000002',
   'Company B active',1000,'prize_draw','x','2026-10-01','2026-10-31','active');
insert into public.company_step_totals
  (challenge_id, company_id, total_steps, contributor_count, opted_in_count, headcount, target_reached, suppressed) values
  ('5c000000-0000-0000-0000-0000000000c1','aaaaaaaa-0000-0000-0000-000000000001',1200000,8,10,12,false,false);
-- userb has an opt-OUT row on Company A's challenge, to prove usera can't see it.
insert into private.company_step_challenge_optins (user_id, challenge_id, opted_in) values
  ('b0000000-0000-0000-0000-00000000000b','5c000000-0000-0000-0000-0000000000c1',false);

-- Replicate Supabase's default public-schema grants so RLS -- not a missing
-- grant -- is the gate (private opt-in grants come from the migration itself).
grant select, insert, update on public.company_step_challenges to authenticated;
grant select, insert, update on public.company_step_totals to authenticated;

-- ---- as usera (Company A employee, NOT HR) ----
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$
declare visible int;
begin
  -- BLOCKED: a non-HR employee cannot author a challenge
  begin
    insert into public.company_step_challenges
      (company_id, title, target_steps, reward_type, reward_name, starts_on, ends_on, status)
    values ('aaaaaaaa-0000-0000-0000-000000000001','sneaky',1000,'prize_draw','x','2026-12-01','2026-12-31','active');
    raise exception 'FAIL challenge-write: a non-HR employee authored a company challenge';
  exception when insufficient_privilege then null;
  end;

  -- VISIBLE: own company's ACTIVE challenge; HIDDEN: its DRAFT and Company B's
  select count(*) into visible from public.company_step_challenges where id='5c000000-0000-0000-0000-0000000000c1';
  if visible <> 1 then raise exception 'FAIL challenge-read: active challenge not visible to its company employee'; end if;
  select count(*) into visible from public.company_step_challenges where id='5c000000-0000-0000-0000-0000000000c2';
  if visible <> 0 then raise exception 'FAIL challenge-read: a draft challenge leaked to an employee'; end if;
  select count(*) into visible from public.company_step_challenges where id='5c000000-0000-0000-0000-0000000000b1';
  if visible <> 0 then raise exception 'FAIL challenge-read: another company''s challenge leaked to an employee'; end if;

  -- VISIBLE: own company's team total (aggregate only)
  select count(*) into visible from public.company_step_totals where challenge_id='5c000000-0000-0000-0000-0000000000c1';
  if visible <> 1 then raise exception 'FAIL totals-read: own-company team total not visible to employee'; end if;

  -- BLOCKED: an employee cannot INSERT an aggregate row (no insert policy)
  begin
    insert into public.company_step_totals (challenge_id, company_id, total_steps)
    values ('5c000000-0000-0000-0000-0000000000c2','aaaaaaaa-0000-0000-0000-000000000001',999);
    raise exception 'FAIL totals-write: an employee inserted an aggregate row';
  exception when insufficient_privilege then null;
  end;

  -- BLOCKED (silent): an employee's UPDATE hits no row (no update policy);
  -- verified unchanged as superuser below.
  update public.company_step_totals set total_steps=999999999 where challenge_id='5c000000-0000-0000-0000-0000000000c1';

  -- ALLOWED: set my OWN opt-in
  begin
    insert into private.company_step_challenge_optins (user_id, challenge_id, opted_in)
    values ('a0000000-0000-0000-0000-00000000000a','5c000000-0000-0000-0000-0000000000c1',false);
  exception when insufficient_privilege then
    raise exception 'FAIL optin-write: a member was blocked from setting their own opt-in';
  end;

  -- BLOCKED: setting ANOTHER user's opt-in
  begin
    insert into private.company_step_challenge_optins (user_id, challenge_id, opted_in)
    values ('b0000000-0000-0000-0000-00000000000b','5c000000-0000-0000-0000-0000000000c1',true);
    raise exception 'FAIL optin-write: a member set another user''s opt-in';
  exception when insufficient_privilege then null;
  end;

  -- ISOLATED: usera sees only their OWN opt-in row, never userb's
  select count(*) into visible from private.company_step_challenge_optins;
  if visible <> 1 then
    raise exception 'FAIL optin-read: expected usera to see exactly 1 (own) opt-in, saw %', visible;
  end if;

  raise notice 'PASS  7* live: employee cannot author/write aggregates, draft + other-company hidden, opt-in own-rows-only + private';
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- the employee's blocked UPDATE must not have changed the aggregate
do $$
declare v bigint;
begin
  select total_steps into v from public.company_step_totals where challenge_id='5c000000-0000-0000-0000-0000000000c1';
  if v <> 1200000 then raise exception 'FAIL totals-write: an employee mutated the team total (now %)', v; end if;
  raise notice 'PASS  7a* the team total is not writable by an employee (unchanged)';
end
$$;

-- ---- as the Company A HR admin ----
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$
declare visible int;
begin
  -- HR sees their own company's challenges (incl. draft) + team total
  select count(*) into visible from public.company_step_challenges where company_id='aaaaaaaa-0000-0000-0000-000000000001';
  if visible < 2 then raise exception 'FAIL hr-read: HR cannot see their own company challenges (saw %)', visible; end if;
  select count(*) into visible from public.company_step_totals where challenge_id='5c000000-0000-0000-0000-0000000000c1';
  if visible <> 1 then raise exception 'FAIL hr-read: HR cannot see their own company team total'; end if;

  -- ALLOWED: HR authors a challenge for their OWN company
  begin
    insert into public.company_step_challenges
      (company_id, title, target_steps, reward_type, reward_name, starts_on, ends_on, status, created_by)
    values ('aaaaaaaa-0000-0000-0000-000000000001','HR made',2000000,'charity_donation','Charity','2027-01-01','2027-01-31','draft',
            '40000000-0000-0000-0000-00000000000a');
  exception when insufficient_privilege then
    raise exception 'FAIL hr-write: HR admin blocked from creating their own company challenge';
  end;

  -- BLOCKED: HR authoring a challenge for ANOTHER company
  begin
    insert into public.company_step_challenges
      (company_id, title, target_steps, reward_type, reward_name, starts_on, ends_on, status)
    values ('bbbbbbbb-0000-0000-0000-000000000002','cross',1000,'prize_draw','x','2027-01-01','2027-01-31','draft');
    raise exception 'FAIL hr-write: HR created a challenge for another company';
  exception when insufficient_privilege then null;
  end;

  raise notice 'PASS  7b* live: HR admin reads/writes ONLY their own company challenges + totals';
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ---- invited-clients-only CHECK: the shared self-signup pool is barred ----
do $$
begin
  begin
    insert into public.company_step_challenges
      (company_id, title, target_steps, reward_type, reward_name, starts_on, ends_on)
    values ('00000000-0000-0000-0000-000000000001','pool',1000,'prize_draw','x','2027-02-01','2027-02-28');
    raise exception 'FAIL direct-guard: a challenge on the shared self-signup pool was allowed';
  exception when check_violation then null;
  end;
  raise notice 'PASS  7c* the shared self-signup pool cannot host a company step challenge (CHECK)';
end
$$;

-- ---- retired reward_type / status values stay barred (tightened CHECKs) -----
-- 20260822000000 dropped 'anthony_visit' and 'pending_confirmation'. Prove the
-- narrowed CHECKs reject them. Inserted as the table owner so RLS is out of the
-- way and a CHECK is the only thing that can bounce an otherwise well-formed row
-- (Company A exists, passes the pool guard, and neither status is 'active' so the
-- one-active-per-company index is not in play). Both inserts must roll back.
do $$
begin
  begin
    insert into public.company_step_challenges
      (company_id, title, target_steps, reward_type, reward_name, starts_on, ends_on, status)
    values ('aaaaaaaa-0000-0000-0000-000000000001','retired reward',1000,'anthony_visit','x','2027-03-01','2027-03-31','draft');
    raise exception 'FAIL retired-reward: reward_type=anthony_visit was accepted after tightening';
  exception when check_violation then null;
  end;

  begin
    insert into public.company_step_challenges
      (company_id, title, target_steps, reward_type, reward_name, starts_on, ends_on, status)
    values ('aaaaaaaa-0000-0000-0000-000000000001','retired status',1000,'prize_draw','x','2027-03-01','2027-03-31','pending_confirmation');
    raise exception 'FAIL retired-status: status=pending_confirmation was accepted after tightening';
  exception when check_violation then null;
  end;

  raise notice 'PASS  7d* retired reward_type/status (anthony_visit / pending_confirmation) are rejected by the tightened CHECKs';
end
$$;

-- ============================================================================
-- LIVE RLS test of EVENTS: published-global reads reach anon; company + draft
-- events never do; ntitt_admin-only authoring; direct booking inserts blocked;
-- and the capacity -> waitlist -> auto-promotion cycle through book_event() /
-- cancel_my_booking(). Reuses Company A/B, usera (A), userb (B) and the admin.
-- ============================================================================
insert into public.events (id, company_id, title, slug, starts_at, capacity, is_published) values
  ('ea000000-0000-0000-0000-0000000000e1', null, 'Global dip', 'global-dip', now() + interval '7 days', 1, true),
  ('ea000000-0000-0000-0000-0000000000e2', 'bbbbbbbb-0000-0000-0000-000000000002', 'Company B meetup', 'company-b-meetup', now() + interval '7 days', null, true),
  ('ea000000-0000-0000-0000-0000000000e3', null, 'Draft dip', 'draft-dip', now() + interval '7 days', null, false);

-- Harness only: vanilla Postgres grants schema USAGE to PUBLIC, but be explicit
-- so the anon read below can't fail for a reason unrelated to the RLS policy.
grant usage on schema public to anon;

-- ---- as anon (the logged-out marketing site) ----
set role anon;
do $$
declare visible int;
begin
  select count(*) into visible from public.events where id = 'ea000000-0000-0000-0000-0000000000e1';
  if visible <> 1 then raise exception 'FAIL events-anon: published global event not visible to anon'; end if;
  select count(*) into visible from public.events where id = 'ea000000-0000-0000-0000-0000000000e2';
  if visible <> 0 then raise exception 'FAIL events-anon: a company-scoped event leaked to anon'; end if;
  select count(*) into visible from public.events where id = 'ea000000-0000-0000-0000-0000000000e3';
  if visible <> 0 then raise exception 'FAIL events-anon: a draft event leaked to anon'; end if;
  raise notice 'PASS  8a* live: anon sees only published GLOBAL events';
end
$$;
reset role;

-- ---- as usera (Company A, not admin) ----
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
do $$
declare visible int; st text;
begin
  -- BLOCKED: a non-admin cannot author an event
  begin
    insert into public.events (title, slug, starts_at, is_published)
    values ('sneaky', 'sneaky-ev', now() + interval '1 day', true);
    raise exception 'FAIL events-write: a non-admin created an event';
  exception when insufficient_privilege then null;
  end;

  -- VISIBLE global; HIDDEN another company's event + draft
  select count(*) into visible from public.events where id = 'ea000000-0000-0000-0000-0000000000e1';
  if visible <> 1 then raise exception 'FAIL events-read: global event not visible to a member'; end if;
  select count(*) into visible from public.events where id = 'ea000000-0000-0000-0000-0000000000e2';
  if visible <> 0 then raise exception 'FAIL events-read: another company''s event leaked to a member'; end if;
  select count(*) into visible from public.events where id = 'ea000000-0000-0000-0000-0000000000e3';
  if visible <> 0 then raise exception 'FAIL events-read: a draft event leaked to a member'; end if;

  -- BLOCKED: a direct booking insert (no member insert policy -> function-only)
  begin
    insert into public.event_bookings (event_id, user_id, status)
    values ('ea000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-00000000000a', 'confirmed');
    raise exception 'FAIL booking-write: a direct booking insert bypassed the function';
  exception when insufficient_privilege then null;
  end;

  -- BLOCKED: booking a company event you don't belong to (usera is Company A)
  begin
    perform public.book_event('ea000000-0000-0000-0000-0000000000e2');
    raise exception 'FAIL booking: usera booked another company''s event';
  exception when others then
    if sqlerrm not like '%not bookable%' then raise; end if;
  end;

  -- ALLOWED: book the global event -> confirmed (capacity 1, first in)
  st := public.book_event('ea000000-0000-0000-0000-0000000000e1');
  if st <> 'confirmed' then raise exception 'FAIL booking: first booker not confirmed (got %)', st; end if;

  raise notice 'PASS  8b* live: non-admin cannot author/direct-book; cross-company booking gated; first booker confirmed';
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);

-- ---- as userb (Company B): waitlisted on the full global event ----
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-00000000000b', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
do $$
declare st text; mine int;
begin
  st := public.book_event('ea000000-0000-0000-0000-0000000000e1');
  if st <> 'waitlisted' then raise exception 'FAIL booking: over-capacity booker not waitlisted (got %)', st; end if;

  -- ISOLATION: userb sees only their own booking on the event
  select count(*) into mine from public.event_bookings where event_id = 'ea000000-0000-0000-0000-0000000000e1';
  if mine <> 1 then raise exception 'FAIL booking-read: expected userb to see exactly 1 (own) booking, saw %', mine; end if;

  -- userb CAN book their OWN company's event
  st := public.book_event('ea000000-0000-0000-0000-0000000000e2');
  if st <> 'confirmed' then raise exception 'FAIL booking: a company member could not book their own company event (got %)', st; end if;

  raise notice 'PASS  8c* live: over-capacity -> waitlisted; bookings own-rows isolated; own-company booking allowed';
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);

-- ---- usera cancels the last confirmed seat -> userb auto-promoted ----
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
do $$
begin
  perform public.cancel_my_booking('ea000000-0000-0000-0000-0000000000e1');
  raise notice 'PASS  8d* live: usera cancelled a confirmed seat';
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);

-- promotion + confirmed_count verified as the superuser (bypasses RLS)
do $$
declare userb_status text; cc int;
begin
  select status into userb_status from public.event_bookings
    where event_id = 'ea000000-0000-0000-0000-0000000000e1' and user_id = 'b0000000-0000-0000-0000-00000000000b';
  if userb_status <> 'confirmed' then
    raise exception 'FAIL waitlist: userb was not promoted after a cancellation (status %)', userb_status;
  end if;
  select confirmed_count into cc from public.events where id = 'ea000000-0000-0000-0000-0000000000e1';
  if cc <> 1 then raise exception 'FAIL confirmed_count: expected 1 after cancel+promote, got %', cc; end if;
  raise notice 'PASS  8e* live: waitlist auto-promotion + confirmed_count maintained';
end
$$;

-- ---- as the ntitt_admin: authoring + reading the full roster ----
select set_config('request.jwt.claim.sub', 'ee000000-0000-0000-0000-0000000000ad', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
do $$
declare roster int;
begin
  begin
    insert into public.events (title, slug, starts_at, is_published, created_by)
    values ('Admin event', 'admin-event', now() + interval '3 days', true, 'ee000000-0000-0000-0000-0000000000ad');
  exception when insufficient_privilege then
    raise exception 'FAIL events-write: an ntitt_admin was blocked from creating an event';
  end;

  -- admin sees the WHOLE roster (usera cancelled + userb confirmed = 2 rows)
  select count(*) into roster from public.event_bookings where event_id = 'ea000000-0000-0000-0000-0000000000e1';
  if roster < 2 then raise exception 'FAIL roster: ntitt_admin cannot see the full booking roster (saw %)', roster; end if;

  raise notice 'PASS  8f* live: ntitt_admin authors events + reads the full roster';
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);

-- ============================================================================
-- LIVE test of the PAST-EVENT GUARD (review round 2): book_event() must reject
-- an event that has already started, even though RLS would let the member read
-- it. The guest path already guards this in app code; this proves the member
-- RPC now does too.
-- ============================================================================
insert into public.events (id, company_id, title, slug, starts_at, is_published) values
  ('ea000000-0000-0000-0000-0000000000e9', null, 'Past dip', 'past-dip', now() - interval '1 day', true);

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
do $$
begin
  begin
    perform public.book_event('ea000000-0000-0000-0000-0000000000e9');
    raise exception 'FAIL past-guard: book_event confirmed a seat on an event that already started';
  exception when others then
    if sqlerrm not like '%already started%' then raise; end if;
  end;
  raise notice 'PASS  8g* live: book_event rejects a past event';
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);

-- ============================================================================
-- LIVE test of reconcile_event_capacity (review round 2): raising an event's
-- capacity must promote the oldest waitlisters into the freed seats. Set up a
-- capacity-1 event with one confirmed + one waitlisted member (via book_event),
-- then raise the cap and reconcile as the superuser (the function is
-- service_role-only). Fresh event id so it doesn't collide with other fixtures.
-- ============================================================================
insert into public.events (id, company_id, title, slug, starts_at, capacity, is_published) values
  ('ea000000-0000-0000-0000-0000000000ea', null, 'Reconcile dip', 'reconcile-dip', now() + interval '5 days', 1, true);

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
do $$ declare st text; begin
  st := public.book_event('ea000000-0000-0000-0000-0000000000ea');
  if st <> 'confirmed' then raise exception 'FAIL reconcile-setup: usera not confirmed (got %)', st; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);

select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-00000000000b', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
do $$ declare st text; begin
  st := public.book_event('ea000000-0000-0000-0000-0000000000ea');
  if st <> 'waitlisted' then raise exception 'FAIL reconcile-setup: userb not waitlisted (got %)', st; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);

do $$
declare bstatus text; cc int;
begin
  -- reconcile is service_role-only: anon/authenticated must NOT hold EXECUTE.
  if has_function_privilege('anon', 'public.reconcile_event_capacity(uuid)', 'execute') then
    raise exception 'FAIL lockdown: anon can execute reconcile_event_capacity';
  end if;
  if has_function_privilege('authenticated', 'public.reconcile_event_capacity(uuid)', 'execute') then
    raise exception 'FAIL lockdown: authenticated can execute reconcile_event_capacity';
  end if;

  update public.events set capacity = 2 where id = 'ea000000-0000-0000-0000-0000000000ea';
  perform public.reconcile_event_capacity('ea000000-0000-0000-0000-0000000000ea');

  select status into bstatus from public.event_bookings
    where event_id = 'ea000000-0000-0000-0000-0000000000ea' and user_id = 'b0000000-0000-0000-0000-00000000000b';
  if bstatus <> 'confirmed' then
    raise exception 'FAIL reconcile: waitlister not promoted after capacity rise (status %)', bstatus;
  end if;
  select confirmed_count into cc from public.events where id = 'ea000000-0000-0000-0000-0000000000ea';
  if cc <> 2 then raise exception 'FAIL reconcile: confirmed_count wrong after promote (got %)', cc; end if;
  raise notice 'PASS  8h* live: reconcile_event_capacity promotes waitlisters when the cap rises (service_role-only)';
end
$$;

-- ============================================================================
-- LIVE test of GUEST booking (Phase 2): a 'pending' booking holds no seat;
-- confirm_guest_booking() claims a seat or waitlists; cancel promotes the next
-- guest. Run as the bootstrap superuser (which can execute the service_role-only
-- functions). Fresh event so it doesn't collide with the member-booking fixtures.
-- ============================================================================
insert into public.events (id, company_id, title, slug, starts_at, capacity, is_published) values
  ('ea000000-0000-0000-0000-0000000000e5', null, 'Guest dip', 'guest-dip', now() + interval '10 days', 1, true);
insert into public.event_bookings (id, event_id, guest_name, guest_email, status) values
  ('9b000000-0000-0000-0000-0000000000b1', 'ea000000-0000-0000-0000-0000000000e5', 'Guest One', 'guest1@x.test', 'pending'),
  ('9b000000-0000-0000-0000-0000000000b2', 'ea000000-0000-0000-0000-0000000000e5', 'Guest Two', 'guest2@x.test', 'pending');

do $$
declare cc int; s1 text; s2 text; b2 text;
begin
  -- a pending booking consumes no capacity
  select confirmed_count into cc from public.events where id = 'ea000000-0000-0000-0000-0000000000e5';
  if cc <> 0 then raise exception 'FAIL guest: a pending booking consumed a seat (confirmed_count=%)', cc; end if;

  -- confirm first -> confirmed
  s1 := public.confirm_guest_booking('9b000000-0000-0000-0000-0000000000b1');
  if s1 <> 'confirmed' then raise exception 'FAIL guest: first confirm not confirmed (got %)', s1; end if;

  -- confirm second -> waitlisted (capacity 1 taken)
  s2 := public.confirm_guest_booking('9b000000-0000-0000-0000-0000000000b2');
  if s2 <> 'waitlisted' then raise exception 'FAIL guest: over-capacity confirm not waitlisted (got %)', s2; end if;

  -- idempotent re-confirm returns the same status, claims nothing new
  if public.confirm_guest_booking('9b000000-0000-0000-0000-0000000000b1') <> 'confirmed' then
    raise exception 'FAIL guest: re-confirm not idempotent';
  end if;

  -- cancel the confirmed guest -> the waitlisted guest is promoted
  perform public.cancel_guest_booking('9b000000-0000-0000-0000-0000000000b1');
  select status into b2 from public.event_bookings where id = '9b000000-0000-0000-0000-0000000000b2';
  if b2 <> 'confirmed' then raise exception 'FAIL guest: waitlisted guest not promoted after cancel (status %)', b2; end if;
  select confirmed_count into cc from public.events where id = 'ea000000-0000-0000-0000-0000000000e5';
  if cc <> 1 then raise exception 'FAIL guest: confirmed_count wrong after cancel+promote (got %)', cc; end if;

  raise notice 'PASS  9* live: guest pending->confirm->waitlist->promote; pending holds no seat; confirm idempotent';
end
$$;

-- ---- guest functions are service_role-only: anon + authenticated are BLOCKED --
-- (regression guard for the default-PUBLIC-execute-grant bug: without the REVOKE
-- in 20260820000000, either role could call these directly and bypass the token.)
insert into public.event_bookings (id, event_id, guest_name, guest_email, status) values
  ('9b000000-0000-0000-0000-0000000000b3', 'ea000000-0000-0000-0000-0000000000e5', 'Guest Three', 'guest3@x.test', 'pending');

set role anon;
do $$
begin
  begin
    perform public.confirm_guest_booking('9b000000-0000-0000-0000-0000000000b3');
    raise exception 'FAIL guest-lockdown: anon executed confirm_guest_booking';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.cancel_guest_booking('9b000000-0000-0000-0000-0000000000b3');
    raise exception 'FAIL guest-lockdown: anon executed cancel_guest_booking';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS  9b* anon cannot execute the guest booking functions';
end
$$;
reset role;

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$
begin
  begin
    perform public.confirm_guest_booking('9b000000-0000-0000-0000-0000000000b3');
    raise exception 'FAIL guest-lockdown: authenticated executed confirm_guest_booking';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.cancel_guest_booking('9b000000-0000-0000-0000-0000000000b3');
    raise exception 'FAIL guest-lockdown: authenticated executed cancel_guest_booking';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS  9c* authenticated cannot execute the guest booking functions';
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ============================================================================
-- LIVE test of PER-COMPANY event authoring (Phase 3): an hr_admin authors events
-- for their OWN company only (never cross-company, never global, never the pool);
-- their members see the published ones (not drafts, not other companies'); and HR
-- reads the roster of their own events. Reuses Company A/B, hra (Company A HR),
-- usera (Company A), userb (Company B).
-- ============================================================================

-- ---- as the Company A HR admin ----
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-00000000000a', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
do $$
begin
  -- ALLOWED: a published event for OWN company
  begin
    insert into public.events (id, company_id, title, slug, starts_at, capacity, is_published)
    values ('ea000000-0000-0000-0000-0000000000e6', 'aaaaaaaa-0000-0000-0000-000000000001',
            'Company A social', 'company-a-social', now() + interval '5 days', 5, true);
  exception when insufficient_privilege then
    raise exception 'FAIL hr-event-write: HR blocked from creating an own-company event';
  end;

  -- ALLOWED: a draft too (to prove HR can see its own drafts below)
  insert into public.events (id, company_id, title, slug, starts_at, is_published)
    values ('ea000000-0000-0000-0000-0000000000e7', 'aaaaaaaa-0000-0000-0000-000000000001',
            'Company A draft', 'company-a-draft', now() + interval '6 days', false);

  -- BLOCKED: an event for ANOTHER company
  begin
    insert into public.events (company_id, title, slug, starts_at)
    values ('bbbbbbbb-0000-0000-0000-000000000002', 'cross', 'cross-ev', now() + interval '5 days');
    raise exception 'FAIL hr-event-write: HR created an event for another company';
  exception when insufficient_privilege then null;
  end;

  -- BLOCKED: a GLOBAL event (company_id NULL is ntitt_admin-only)
  begin
    insert into public.events (company_id, title, slug, starts_at)
    values (null, 'sneaky global', 'sneaky-global', now() + interval '5 days');
    raise exception 'FAIL hr-event-write: HR created a global event';
  exception when insufficient_privilege then null;
  end;

  raise notice 'PASS  10a* live: HR authors own-company events; blocked cross-company + global';
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);

-- pool guard: even the superuser can't put an event on the shared self-signup pool
do $$
begin
  begin
    insert into public.events (company_id, title, slug, starts_at)
    values ('00000000-0000-0000-0000-000000000001', 'pool', 'pool-ev', now() + interval '5 days');
    raise exception 'FAIL pool-guard: an event on the shared self-signup pool was allowed';
  exception when check_violation then null;
  end;
  raise notice 'PASS  10b* the self-signup pool cannot host a company event (CHECK)';
end
$$;

-- ---- as usera (Company A member): sees the published one, not the draft; books it ----
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
do $$
declare v int; st text;
begin
  select count(*) into v from public.events where id = 'ea000000-0000-0000-0000-0000000000e6';
  if v <> 1 then raise exception 'FAIL member-read: own-company published event not visible to its member'; end if;
  select count(*) into v from public.events where id = 'ea000000-0000-0000-0000-0000000000e7';
  if v <> 0 then raise exception 'FAIL member-read: a company draft leaked to a member'; end if;
  st := public.book_event('ea000000-0000-0000-0000-0000000000e6');
  if st <> 'confirmed' then raise exception 'FAIL member-book: own-company event not bookable (got %)', st; end if;
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);

-- ---- as userb (Company B member): must NOT see Company A's event ----
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-00000000000b', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
do $$
declare v int;
begin
  select count(*) into v from public.events where id = 'ea000000-0000-0000-0000-0000000000e6';
  if v <> 0 then raise exception 'FAIL member-read: another company''s event leaked to a member'; end if;
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);

-- ---- as the Company A HR admin: sees own drafts + reads the roster ----
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-00000000000a', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
do $$
declare v int;
begin
  select count(*) into v from public.events where id = 'ea000000-0000-0000-0000-0000000000e7';
  if v <> 1 then raise exception 'FAIL hr-read: HR cannot see its own-company draft event'; end if;
  select count(*) into v from public.event_bookings where event_id = 'ea000000-0000-0000-0000-0000000000e6';
  if v <> 1 then raise exception 'FAIL hr-roster: HR cannot read its own-company event bookings (saw %)', v; end if;
  raise notice 'PASS  10c* live: member sees published (not draft), cross-company hidden; HR reads own drafts + roster';
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);

-- ---- 11. event-images storage bucket: public read + author-gated writes -----
-- The bucket that backs the event authoring form's image upload. Public read
-- (same rationale as community-images/content-assets); the boundary is that a
-- write is admitted only for an event author — ntitt_admin OR hr_admin — unlike
-- content-assets, which is ntitt_admin only.
do $$
declare is_public boolean; wc text; found boolean := false;
begin
  select public into is_public from storage.buckets where id = 'event-images';
  if is_public is distinct from true then
    raise exception 'event-images bucket missing or not public';
  end if;
  for wc in
    select pg_get_expr(polwithcheck, polrelid)
      from pg_policy where polrelid = 'storage.objects'::regclass and polcmd = 'a'
  loop
    if wc is not null and position('event-images' in wc) > 0 then
      found := true;
      if position('hr_admin' in wc) = 0 or position('ntitt_admin' in wc) = 0 then
        raise exception 'event-images INSERT policy is not gated to both event-author roles: %', wc;
      end if;
    end if;
  end loop;
  if not found then raise exception 'no INSERT policy on storage.objects for event-images'; end if;
  raise notice 'PASS  11  event-images bucket public + writes gated to ntitt_admin/hr_admin';
end
$$;

-- ---- 12. Notice Board: ntitt_admin-only writes; notice-media bucket public ---
do $$
declare wc text; is_public boolean;
begin
  select pg_get_expr(polwithcheck, polrelid) into wc
    from pg_policy where polrelid = 'public.notices'::regclass and polcmd = 'a';
  if wc is null then raise exception 'no INSERT policy on notices'; end if;
  if position('ntitt_admin' in wc) = 0 then
    raise exception 'notices INSERT policy is not ntitt_admin gated: %', wc;
  end if;
  -- notices are a members'-app surface: anon must have NO SELECT grant (unlike
  -- events, which anon reads for the marketing site).
  if has_table_privilege('anon', 'public.notices', 'select') then
    raise exception 'anon can read notices (must be members-only)';
  end if;
  select public into is_public from storage.buckets where id = 'notice-media';
  if is_public is distinct from true then
    raise exception 'notice-media bucket missing or not public';
  end if;
  raise notice 'PASS  12  notices writes ntitt_admin-gated; anon has no read; notice-media bucket public';
end
$$;

-- ============================================================================
-- LIVE RLS test of NOTICES: ntitt_admin-only authoring; a member reads a
-- PUBLISHED notice but never a draft. Reuses usera (Company A, non-admin) and the
-- ntitt_admin (ee…ad) created in the content-spine fixtures above.
-- ============================================================================
insert into public.notices (id, title, media_kind, is_published) values
  ('7a000000-0000-0000-0000-0000000000f1', 'Published notice', 'none', true),
  ('7a000000-0000-0000-0000-0000000000f2', 'Draft notice', 'none', false);

-- Replicate Supabase's default public-schema grants so RLS -- not a missing
-- grant -- is the gate (same pattern as the content/challenge blocks above).
grant select, insert on public.notices to authenticated;

-- ---- as usera (Company A, NOT an admin) ----
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
do $$
declare visible int;
begin
  -- BLOCKED: a non-admin cannot author a notice
  begin
    insert into public.notices (title, media_kind, is_published)
    values ('sneaky', 'none', true);
    raise exception 'FAIL notice-write: a non-admin was allowed to author a notice';
  exception when insufficient_privilege then null;
  end;

  -- VISIBLE: a published notice
  select count(*) into visible from public.notices where id = '7a000000-0000-0000-0000-0000000000f1';
  if visible <> 1 then raise exception 'FAIL notice-read: published notice not visible to a member'; end if;

  -- HIDDEN: a draft notice
  select count(*) into visible from public.notices where id = '7a000000-0000-0000-0000-0000000000f2';
  if visible <> 0 then raise exception 'FAIL notice-read: a draft notice leaked to a member'; end if;

  raise notice 'PASS  12a* live: non-admin notice write blocked; published visible, draft hidden';
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);

-- ---- as the ntitt_admin: authoring must succeed; media CHECK holds ----
select set_config('request.jwt.claim.sub', 'ee000000-0000-0000-0000-0000000000ad', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
do $$
begin
  begin
    insert into public.notices (title, media_kind, vimeo_id, is_published, created_by)
    values ('admin vimeo notice', 'vimeo', '123456789', true, 'ee000000-0000-0000-0000-0000000000ad');
  exception when insufficient_privilege then
    raise exception 'FAIL notice-write: an ntitt_admin was blocked from authoring a notice';
  end;

  -- media CHECK: kind='vimeo' with no vimeo_id must be rejected
  begin
    insert into public.notices (title, media_kind, is_published, created_by)
    values ('bad vimeo', 'vimeo', true, 'ee000000-0000-0000-0000-0000000000ad');
    raise exception 'FAIL notice-check: media_kind=vimeo with no vimeo_id was accepted';
  exception when check_violation then null;
  end;

  raise notice 'PASS  12b* live: ntitt_admin authoring allowed; media_kind CHECK enforced';
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);

-- ---- 13. Notice video files (PR2): notice-videos bucket public + admin writes -
-- The bucket that backs media_kind='video' (uploaded video files). Public read
-- (same rationale as notice-media); the boundary is the WRITE policy, gated to
-- ntitt_admin exactly like notice-media. It's a separate bucket from notice-media
-- because video files need their own (larger) size + video MIME limits.
do $$
declare is_public boolean; wc text; found boolean := false;
begin
  select public into is_public from storage.buckets where id = 'notice-videos';
  if is_public is distinct from true then
    raise exception 'notice-videos bucket missing or not public';
  end if;
  for wc in
    select pg_get_expr(polwithcheck, polrelid)
      from pg_policy where polrelid = 'storage.objects'::regclass and polcmd = 'a'
  loop
    if wc is not null and position('notice-videos' in wc) > 0 then
      found := true;
      if position('ntitt_admin' in wc) = 0 then
        raise exception 'notice-videos INSERT policy is not ntitt_admin gated: %', wc;
      end if;
    end if;
  end loop;
  if not found then raise exception 'no INSERT policy on storage.objects for notice-videos'; end if;
  raise notice 'PASS  13  notice-videos bucket public + writes gated to ntitt_admin';
end
$$;

-- ---- 14. Thursday Thoughts quote bank seeded contiguously -------------------
-- getDailyQuote resolves a quote via resolveBankPosition(isoWeek, count) =
-- ((isoWeek - 1) % count) + 1, which only lands on a real row when the
-- bank_positions are a contiguous 1..count sequence. Assert the seed applied
-- (15 rows) and the sequence has no gap, so no ISO week resolves to a missing
-- position.
do $$
declare total int; distinct_positions int; min_pos int; max_pos int; blank int;
begin
  select count(*), count(distinct bank_position), min(bank_position), max(bank_position)
    into total, distinct_positions, min_pos, max_pos
    from public.daily_quotes;
  if total <> 15 then
    raise exception 'FAIL daily_quotes: expected 15 seeded quotes, found %', total;
  end if;
  if distinct_positions <> 15 or min_pos <> 1 or max_pos <> 15 then
    raise exception 'FAIL daily_quotes: bank_position is not a contiguous 1..15 (distinct=%, min=%, max=%)', distinct_positions, min_pos, max_pos;
  end if;
  select count(*) into blank from public.daily_quotes where coalesce(btrim(quote_text), '') = '';
  if blank <> 0 then raise exception 'FAIL daily_quotes: % quotes have empty text', blank; end if;
  raise notice 'PASS  14  Thursday Thoughts quote bank seeded contiguously (15 rows, 1..15)';
end
$$;

-- ---- 15. profiles.last_seen_at activity marker + throttled self-touch -------
-- (20260831000000) last_seen_at powers the admin active-users metric. It must be
-- a nullable timestamptz; touch_last_seen() must be SECURITY DEFINER; and a
-- member must NOT be able to write last_seen_at directly (spoofing activity).
do $$
declare col_type text; col_nullable text; is_def boolean;
begin
  select data_type, is_nullable into col_type, col_nullable
    from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='last_seen_at';
  if col_type is null then raise exception 'profiles.last_seen_at missing (active-users metric)'; end if;
  if col_type <> 'timestamp with time zone' then
    raise exception 'profiles.last_seen_at is % (expected timestamptz)', col_type;
  end if;
  if col_nullable <> 'YES' then raise exception 'profiles.last_seen_at must be nullable'; end if;

  select p.prosecdef into is_def from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='touch_last_seen';
  if is_def is null then raise exception 'touch_last_seen() missing'; end if;
  if not is_def then raise exception 'touch_last_seen() must be SECURITY DEFINER'; end if;

  if has_column_privilege('authenticated','public.profiles','last_seen_at','update') then
    raise exception 'authenticated can UPDATE profiles.last_seen_at (activity spoofing)';
  end if;
  raise notice 'PASS  15  profiles.last_seen_at present (timestamptz, nullable); touch_last_seen() SECURITY DEFINER; not member-writable';
end
$$;

-- live: touch_last_seen() stamps only the caller's own row; a direct write is
-- refused. Reuses usera / userb (their last_seen_at is null from the fixtures).
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$
declare seen_after timestamptz;
begin
  -- BLOCKED: a direct UPDATE of last_seen_at (no column grant) must be refused
  begin
    update public.profiles set last_seen_at = now() where id = 'a0000000-0000-0000-0000-00000000000a';
    raise exception 'FAIL last_seen: a member wrote last_seen_at directly (spoofable)';
  exception when insufficient_privilege then null;
  end;

  -- ALLOWED: the throttled self-touch stamps the caller's own row
  perform public.touch_last_seen();
  select last_seen_at into seen_after from public.profiles where id='a0000000-0000-0000-0000-00000000000a';
  if seen_after is null then raise exception 'FAIL last_seen: touch_last_seen did not stamp the caller row'; end if;

  raise notice 'PASS  15* live: touch_last_seen stamps the caller; direct member write refused';
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ISOLATED: usera's touch must not have stamped userb's row (checked as the
-- bootstrap superuser, which bypasses RLS -- usera can't even see userb's row).
do $$
declare other_seen timestamptz;
begin
  select last_seen_at into other_seen from public.profiles where id='b0000000-0000-0000-0000-00000000000b';
  if other_seen is not null then
    raise exception 'FAIL last_seen: touch_last_seen stamped another user''s row (%)' , other_seen;
  end if;
  raise notice 'PASS  15** touch_last_seen touched only the caller, not other members';
end
$$;

-- ---- 16. content_items video metadata columns (thumbnail_url + vimeo_hash) --
-- (20260901000000) both nullable text, additive; the media CHECK is unchanged.
do $$
declare thumb_type text; thumb_null text; hash_type text; hash_null text;
begin
  select data_type, is_nullable into thumb_type, thumb_null
    from information_schema.columns
    where table_schema='public' and table_name='content_items' and column_name='thumbnail_url';
  if thumb_type is null then raise exception 'content_items.thumbnail_url missing (video posters)'; end if;
  if thumb_type <> 'text' then raise exception 'content_items.thumbnail_url is % (expected text)', thumb_type; end if;
  if thumb_null <> 'YES' then raise exception 'content_items.thumbnail_url must be nullable'; end if;

  select data_type, is_nullable into hash_type, hash_null
    from information_schema.columns
    where table_schema='public' and table_name='content_items' and column_name='vimeo_hash';
  if hash_type is null then raise exception 'content_items.vimeo_hash missing (private video embed)'; end if;
  if hash_type <> 'text' then raise exception 'content_items.vimeo_hash is % (expected text)', hash_type; end if;
  if hash_null <> 'YES' then raise exception 'content_items.vimeo_hash must be nullable'; end if;

  raise notice 'PASS  16  content_items.thumbnail_url + vimeo_hash present (text, nullable)';
end
$$;

\echo ''
\echo 'ALL ASSERTIONS PASSED'
