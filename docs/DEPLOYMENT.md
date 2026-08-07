# Deployment runbook (Phase 8: go live)

This is the exact, step-by-step path to a real Supabase project and a real
Vercel deployment. It exists because the build environment used for every
prior phase **cannot do this part itself**: its outbound network policy
denies `supabase.com`, `api.supabase.com`, and `api.vercel.com` at the proxy
level (confirmed via the proxy's status endpoint — a `403` policy denial, not
a bug or a missing tool), and account/project creation requires an
interactive login regardless. Everything here has to be run by a human with
real Supabase/Vercel accounts.

The 11 migrations under `supabase/migrations/` have already been dry-run
validated end-to-end against a real local Postgres 16 instance (stubbing
only the parts Supabase's GoTrue normally provides — the `auth` schema,
`auth.uid()`/`auth.role()`, and the `anon`/`authenticated`/`service_role`
roles). All 11 apply cleanly in order with zero errors, and the resulting
schema has Row Level Security enabled on all 23 tables across `public` and
`private` — this is the real privacy boundary (see "Privacy boundary: how
it's actually enforced" below in this doc's sibling, `ARCHITECTURE.md`).
This runbook should not surface any migration errors; if it does, something
about the target project differs from what's expected and is worth stopping
to investigate rather than pushing through.

## 1. Create the Supabase project

1. Create a new project at [supabase.com](https://supabase.com) (org of your
   choice). Note the **project ref** (in the dashboard URL and in
   Settings → General) and set a strong database password — save it, you'll
   need it for the migration step.
2. **Settings → API → Exposed schemas**: add `private` alongside the default
   `public` and `graphql_public`. This is not optional — `supabase/config.toml`
   documents why: our own server code reaches Postgres through the same
   PostgREST/`authenticated` path as any outside caller, so if `private`
   isn't exposed here, every journal/check-in/review read and write breaks,
   not just outside access. See `supabase/config.toml`'s comment and
   `docs/ARCHITECTURE.md`'s "Privacy boundary" section for the full
   reasoning — this was deliberately tested and reverted the other way once
   already.
3. **Authentication → Sign In / Providers**: confirm email (magic link) is
   enabled; that's the only auth method this app uses.
4. **Authentication → URL Configuration**:
   - Site URL: the real production URL (e.g. `https://app.ntitt.co.uk`).
   - Redirect URLs: add the production URL and any preview/staging URLs you
     want magic links to work from.
   - Confirm signups: `enable_signup` is `true` in `supabase/config.toml` —
     the direct/public platform now has self-service signup
     (`src/lib/actions/signup.ts`, `/signup`), landing every public account
     in the shared "NTITT Direct" company seeded by
     `20260807000000_direct_company_seed.sql`. Partner co-branded companies
     stay invite-only — employees and HR admins there are still provisioned
     only by the in-app admin-invite flow (`src/lib/actions/invite.ts` —
     `hr_admin` invites employees to their own company, `ntitt_admin`
     invites anyone to any company/role); `/signup` and `signUp()` both
     refuse to run when the request resolves to a partner company. Mirror
     the `true` setting in the dashboard (Authentication → Sign In → enable
     public sign-ups) — this is a live, separate setting from
     `config.toml`, so it needs to be flipped there too, not inferred from
     this repo alone.

## 2. Run the migrations

From a machine with network access to Supabase and the `supabase` CLI
(`npx supabase --version` to confirm, or `npm install -g supabase`):

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This applies all 12 files in `supabase/migrations/` in filename order:

1. `20260730000000_init_schema.sql` — companies, profiles, content library,
   the aggregate tables, and every `private` schema table (journal-style
   content, RLS-restricted to `auth.uid() = user_id`).
2. `20260731000000_phase2_daily_core_loop.sql` — themed check-ins, Sunday
   Setup, periodic reviews.
3. `20260731010000_phase6_company_dashboard.sql` — adds
   `companies.ninety_day_report_sent_at`.
4. `20260731020000_add_ntitt_admin_role.sql` — adds the `ntitt_admin` enum
   value. Deliberately its own migration/transaction — Postgres forbids
   using a newly-added enum value before it's committed, so it can't be
   combined with the migration that uses it.
5. `20260731030000_phase7_community.sql` — community posts/comments/likes/
   reports and their RLS policies.
6. `20260731040000_phase9_community_photo_storage.sql` — Storage bucket +
   policies for real Community photo uploads.
7. `20260731050000_phase9_profile_timezone.sql` — adds `profiles.timezone`.
8. `20260731070000_phase9_push_notifications.sql` — push subscriptions and
   the send-log table.
9. `20260731080000_account_provisioning.sql` — the `handle_new_user`
   trigger backing the admin-invite flow.
10. `20260731090000_fix_handle_new_user_non_blocking.sql` — makes that
    trigger a no-op instead of aborting account creation when invite
    metadata isn't attached in time (see `src/lib/actions/invite.ts`, which
    is the actual reliable mechanism now).
11. `20260731100000_sunday_notification_default.sql` — default/backfill for
    `profiles.sunday_notification_time`.
12. `20260807000000_direct_company_seed.sql` — seeds the shared "NTITT
    Direct" `companies` row every self-service `/signup` account is
    assigned to. Unlike `supabase/seed.sql` below, this is a real migration
    file, so `supabase db push` applies it automatically — no separate
    manual step needed for this one.

If you don't have `supabase` CLI access from wherever you're running this,
the fallback is pasting each file's contents into the Supabase Studio SQL
Editor in the same order and running them one at a time — same result,
just manual.

**Verify after running:** Table Editor should show 16 tables under `public`
and 7 under `private` (23 total), and every one should have the RLS toggle
enabled (Supabase's Table Editor shows this directly, or run the query
below in the SQL Editor):

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname in ('public','private')
order by schemaname, tablename;
```

Every row should show `rowsecurity = true`. If any is `false`, stop —
something didn't apply correctly.

**Also run `supabase/seed.sql`** (Phase 10) — seeds the two confirmed
co-branded companies (Amazon, KP Snacks; see that file's comment for why
only these two of the 8 partner logos). `supabase db push` does **not**
run this automatically against a remote project (only `supabase db reset`
does, and only for local dev) — apply it the same way as a migration,
either `psql <connection-string> -f supabase/seed.sql` or pasted into
Studio's SQL Editor. Safe to re-run (`on conflict (slug) do nothing`).

## 3. One-time manual data setup

Every account at a partner co-branded company is provisioned through the
in-app invite flow (`hr_admin`/`ntitt_admin` → "Invite" — see
`src/lib/actions/invite.ts`); direct/public accounts self-provision via
`/signup` into the shared "NTITT Direct" company instead (see step 2's
migration 12). But the invite flow needs an `ntitt_admin` to already exist
to send the very first invite, which is the one genuine chicken-and-egg
case: nobody can invite the first admin, since nobody with invite rights
exists yet. This step is that one-time exception, not a pattern to repeat
for later accounts.

1. In Table Editor, insert a `companies` row for NTITT itself (e.g.
   `name: "NTITT (internal)"`, any unique `slug`) — an `ntitt_admin`
   profile still needs a non-null `company_id` to satisfy the `NOT NULL`
   constraint, even though moderation itself isn't company-scoped.
2. In Authentication → Users, **Add user** (not the same thing as inviting —
   this creates a confirmed account directly, as an admin action, without
   going through `/signup` or the invite flow) for whoever will moderate
   Community/send the first invites.
3. In Table Editor, insert a `profiles` row for that user: `id` = the
   user's UUID from step 2, `company_id` = the row from step 1, `role` =
   `ntitt_admin`.
4. From here on, that person can sign in and use `/admin/invite` to invite
   every other `ntitt_admin`, `hr_admin`, and employee — no more manual SQL.

## 4. Create the Vercel project

1. Import this GitHub repo into a new Vercel project.
2. **Settings → Environment Variables**: set every variable listed in
   `.env.example` for the Production environment (and Preview, if you want
   preview deploys to work against the same or a staging Supabase project).
   Do not reuse `SUPABASE_SERVICE_ROLE_KEY` anywhere client-exposed — it's
   server-only, used by `src/lib/supabase/admin.ts` for the aggregation
   job, the PDF report generator, and the Twilio status webhook.
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` still need a real
   keypair generated (`npx web-push generate-vapid-keys`) — they're blank
   placeholders in `.env.example`.
3. **Settings → Domains**: point the production domain
   (`app.ntitt.co.uk`, per `NEXT_PUBLIC_APP_ROOT_DOMAIN`) and any
   co-branded subdomains at this project.
4. **Settings → Cron Jobs / plan tier**: `vercel.json` defines 3 cron jobs,
   one of which (`monitor-support-response-time`) runs every 15 minutes.
   Vercel's Hobby plan caps cron at once per day per job — confirmed live
   during this project's own deploy attempt (Vercel rejected the deployment
   with exactly this error) — so this needs at least a Pro plan for the
   support-response monitor to actually run on schedule. **Resolved**:
   upgraded to Pro.
5. Deploy. Once live, smoke-test:
   - Sign in via magic link end-to-end.
   - Create an account via `/signup` on the production root domain
     end-to-end, confirm the resulting profile lands in the "NTITT Direct"
     company, and confirm `/signup` redirects to `/login` on a partner
     subdomain instead of rendering the form.
   - Trigger the Twilio webhook path (`/api/webhooks/twilio-status`) and
     confirm it's reachable without a session (it authenticates itself
     independently — see `src/proxy.ts`'s matcher, which excludes `api/`
     entirely).
   - Manually hit each cron job's route once with the `CRON_SECRET` bearer
     token to confirm it runs before trusting the schedule.

## 5. Real vendor credentials

Twilio (Ask for Support SMS), Brevo (transactional email), and Vimeo
(content video hosting) all need real accounts/API credentials — see
`.env.example` for exactly which vars each needs and the inline comments in
`src/lib/support/alert.ts` for what Twilio/Brevo are each used for.
`TWILIO_STATUS_CALLBACK_URL` must match the real deployed URL of
`src/app/api/webhooks/twilio-status/route.ts` once step 4 is live.

---

Nothing in this document should be treated as "run once and forget" — if a
future migration changes the schema, re-run `supabase db push` the same way;
if `.env.example` gains a new variable, add it to Vercel's Production
environment before the next deploy that depends on it.
