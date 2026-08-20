## What & why

<!-- What this change does and the reason for it. -->

## Changes

<!-- The notable changes, as bullets. -->

## Verification

- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build` — green
- [ ] Migration harness (`supabase/tests/validate_migrations.sh`) — if migrations changed
- [ ] Render check (desktop + mobile) — if UI changed

## Production steps after merge

<!-- merged ≠ live. Tick what applies or write "None". See docs/POST_MERGE_PROD_CHECKLIST.md -->

- [ ] **None** — pure code/UI, no prod config needed
- [ ] **Migrations** — new files under `supabase/migrations/` → run `npx supabase db push` against prod (CI only dry-runs them)
- [ ] **Supabase project settings** — an Auth hook, storage policy, exposed schema, or redirect URL that must be toggled in the Dashboard (`config.toml` is local-dev only)
- [ ] **Env vars** — new var in `.env.example` → set on Vercel (Production) and redeploy
- [ ] **Verified** — after the above, `GET /api/health?detail=1` shows `config.criticalOk: true` and `schema.ok: true`
