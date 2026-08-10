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
  if total <> 23 then
    raise exception 'expected 23 public+private tables (16+7), found %', total;
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

\echo ''
\echo 'ALL ASSERTIONS PASSED'
