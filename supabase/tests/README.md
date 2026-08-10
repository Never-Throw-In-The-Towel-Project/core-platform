# Migration validation harness

Dry-run validates every file in `supabase/migrations/` against a throwaway
local Postgres, then asserts the privacy/security boundary the platform depends
on. This is the "standard step" `docs/DEPLOYMENT.md` refers to before a merge
that touches the schema — made reproducible so it runs the same way every time.

```bash
supabase/tests/validate_migrations.sh
```

Requires a local Postgres (`initdb`/`pg_ctl`/`psql`, v15+). No network access
and no Supabase CLI needed; nothing is left running or on disk afterward. Exit
code is non-zero if any migration fails to apply or any assertion fails.

## What it does

1. **`stub_supabase.sql`** — creates only what a real Supabase project
   provisions out of band: the `auth` and `storage` schemas, `auth.uid()` /
   `auth.role()`, `storage.foldername()`, minimal `auth.users` /
   `storage.buckets` / `storage.objects`, and the `anon` / `authenticated` /
   `service_role` roles. Everything else is created by the migrations under
   test.
2. Applies every migration in filename order with `ON_ERROR_STOP=1` (fail-fast),
   then `supabase/seed.sql`.
3. **`assertions.sql`** — regression guard (raises on any violation):
   - RLS is enabled on all 23 `public`/`private` tables (16 + 7).
   - `handle_new_user` ignores client-supplied `role`/`company_id` (a direct
     GoTrue signup lands as a plain `employee` in NTITT Direct).
   - The `community_comments` INSERT policy binds `scope`/`company_id` to the
     parent post — exercised **live** as the `authenticated` role with a
     simulated JWT sub (a mislabeled cross-company comment is blocked; a
     matching one is allowed).
   - `companies` support-contact PII columns are revoked from
     `anon`/`authenticated` while branding columns stay readable.
   - `community_reports` has the `unique (post_id, reporter_user_id)` dedup
     constraint, and a genuine duplicate raises `unique_violation`.
   - The `community-images` storage bucket and its object policies exist.

## Caveats

This validates SQL apply-ability plus role/RLS/GRANT behaviour against the real
Postgres engine. It does **not** stand up PostgREST or GoTrue, so it can't
exercise the HTTP/JWT layer end-to-end — the RLS checks reproduce what
PostgREST does per request (set the role, set the JWT-claim GUCs) directly in
SQL, which is enough to catch policy regressions but is not a full integration
test.
