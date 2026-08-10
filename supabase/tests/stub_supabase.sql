-- ============================================================================
-- Stub for the objects Supabase/GoTrue provisions OUT OF BAND, so the app's
-- own migrations can be dry-run applied against a plain Postgres 16 (the
-- validation approach documented in docs/DEPLOYMENT.md). This mirrors ONLY
-- what a real Supabase project provides for us -- the auth & storage schemas,
-- auth.uid()/auth.role(), storage.foldername(), and the platform roles -- not
-- any of our own schema, which is what the migrations under test create.
-- ============================================================================

-- Platform roles Supabase creates. NOLOGIN is fine for an apply test; only
-- their existence (for GRANT/REVOKE and policy role targets) matters here.
-- service_role carries BYPASSRLS in real Supabase -- keep that faithful.
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

-- ---- auth schema -----------------------------------------------------------
create schema if not exists auth;

-- Minimal auth.users: the columns our FKs (references auth.users(id)) and the
-- handle_new_user trigger (new.id / new.email / new.raw_user_meta_data) touch.
-- Real GoTrue's table has many more columns; none of the rest is referenced.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- GoTrue derives these from the request JWT claims (set as GUCs by PostgREST).
-- The stubs read the same GUCs, so a test can impersonate a user with
-- set_config('request.jwt.claim.sub', '<uuid>', true); absent that they
-- return NULL, exactly as an unauthenticated request would.
create or replace function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create or replace function auth.role() returns text
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;

-- ---- storage schema --------------------------------------------------------
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

-- Real storage.objects already ships with RLS enabled; the photo-upload
-- migration adds policies on top of that, so enable it here too.
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text
);
alter table storage.objects enable row level security;

-- Supabase's helper: splits an object path into its folder segments. The
-- upload policy uses (storage.foldername(name))[1] as the owner prefix.
create or replace function storage.foldername(name text) returns text[]
  language sql immutable
  as $$ select string_to_array(name, '/') $$;

-- Supabase grants schema usage on auth/storage to the platform roles.
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;
