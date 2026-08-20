# Post-merge production checklist — "merged ≠ live"

Merging a PR and letting Vercel deploy ships the **code**. It does **not** apply
database migrations, change Supabase **project** settings, or set new **env
vars**. CI (`.github/workflows/ci.yml`) only *dry-runs* migrations against a
throwaway Postgres — it never touches the live database. So a change can be
green, merged, and deployed while still broken in production because a manual
step was missed.

Run through this after merging any PR whose "Production steps after merge"
section is non-empty. Two real incidents this prevents:

- **Clean Streak "Couldn't start that."** The `habit_*` migration was merged but
  not `db push`-ed, so `private.habit_challenges` didn't exist in prod; reads
  degraded silently, writes failed.
- **Auth emails still "powered by Supabase."** The Send Email hook config in
  `supabase/config.toml` is **local-dev only**; the hook was never enabled on the
  hosted project, so GoTrue sent its own default emails.

---

## 1 · Database migrations

If the PR added files under `supabase/migrations/`:

```bash
npx supabase link --project-ref <prod-project-ref>   # once
npx supabase db push                                 # applies all pending migrations
```

`db push` does **not** run `supabase/seed.sql` against a remote project — if the
PR changed seed data, apply it separately (`psql "$DB_URL" -f supabase/seed.sql`,
or paste into Studio → SQL Editor). No CLI? Paste each new migration file into
Studio → SQL Editor in filename order. See `docs/DEPLOYMENT.md` for detail.

**Verify:** Table Editor shows the new tables with **RLS enabled**, or the
`/api/health` schema probe reads `ok` (below).

## 2 · Supabase project settings (not in `config.toml`)

`supabase/config.toml` configures **local dev only**. Anything it declares that
lives on the hosted project must be set in the Dashboard (or `supabase config
push`). Most common:

- **Auth Send Email hook** (branded auth mail): Dashboard → **Authentication →
  Hooks → Send Email** → enable, URI `https://<prod-domain>/api/auth/send-email`,
  generate the `v1,whsec_…` secret. Then set that exact secret as
  `SUPABASE_AUTH_HOOK_SECRET` on Vercel (step 3). Full steps: `docs/SMTP_SETUP.md`.
- Exposed schemas, storage bucket policies, auth providers, redirect URLs.

## 3 · Environment variables

If the PR added a var to `.env.example`, set it on **Vercel → Production** and
redeploy. The launch-critical set is listed in `docs/LAUNCH_READINESS.md`
("Required prod env vars"). Unset vars **silently no-op** and disable a feature
(email, push, the support safety net, branded auth mail) with no error.

## 4 · Verify readiness (`/api/health`)

Public liveness (no auth):

```bash
curl -s https://<prod-domain>/api/health          # {"status":"ok","database":"ok",...}
```

Full readiness report (authenticated with the cron bearer):

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://<prod-domain>/api/health?detail=1"
```

Confirm in the response:

- `config.criticalOk: true` — every launch-critical env group is set (any gap is
  named under `config.groups[].missing`, values never shown).
- `schema.ok: true` — every recent migration is applied (`schema.missing[]` names
  the table + the migration id that hasn't been `db push`-ed).

If either is false, the code is live but a step above was missed — fix it before
telling users the feature is ready.

> Keeping the probe honest: when a migration adds a feature's core table, add its
> newest table to `SCHEMA_SENTINELS` in `src/lib/health/schema.ts`, and when a
> feature needs a new prod env var, add it to `GROUP_DEFS` in
> `src/lib/health/config.ts` and `.env.example`.
