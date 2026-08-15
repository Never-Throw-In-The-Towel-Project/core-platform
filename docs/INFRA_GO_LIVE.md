# Infra go-live checklist — the three-journeys platform

The **code** for the three-journeys structure (Core / Company / Control Tower) is
merged and done — see `docs/PLATFORM_STRUCTURE.md`. What's left to actually take
it live is **dashboard/DNS/config work only NTITT can do** (Vercel, Supabase, DNS,
seed data). This is the tick-list.

Nothing here needs an engineer or a deploy. The build environment cannot reach
`vercel.com` / `api.supabase.com` (network policy — see `docs/DEPLOYMENT.md`), so
every step below is done by a human in the relevant dashboard.

> **The load-bearing idea:** the app resolves *host → company* from the database at
> request time, and the `*.neverthrowinthetowel.uk` wildcard makes every subdomain
> resolve automatically. So once the wildcard + cert are live, **creating a company
> row = a live branded portal** — no DNS or deploy per company. The one rule:
> **the company's `slug` must equal the subdomain label exactly** (`kp-snacks` →
> `kp-snacks.neverthrowinthetowel.uk`).

Root domain used throughout: **`neverthrowinthetowel.uk`** (the app's
`NEXT_PUBLIC_APP_ROOT_DOMAIN`; note email still sends from `@ntitt.co.uk`, see §5).

---

## 1. Vercel domains + DNS

Add all three to the `core-platform` Vercel project (Settings → Domains):

- [ ] **`neverthrowinthetowel.uk`** (apex) — Valid Configuration
- [ ] **`admin.neverthrowinthetowel.uk`** — Valid Configuration
- [ ] **`*.neverthrowinthetowel.uk`** (wildcard) — resolves + serves HTTPS

**About the wildcard's "Proxy Status Unknown" warning:** it's usually **cosmetic**.
Vercel checks proxy status by probing one hostname, and a wildcard has no single
hostname to probe — so it can't report a status. If a real subdomain loads in a
browser with a valid padlock (see §6), the wildcard is fine regardless of the label.

The only two things that actually break a wildcard, both on third-party DNS:

- [ ] **`*` DNS record present** — a `CNAME *` → `cname.vercel-dns.com` (or the A
  record Vercel shows under **"View DNS configuration"** on the wildcard row). If a
  subdomain gives "server not found", this is missing.
- [ ] **Wildcard TLS certificate issued** — Vercel needs a DNS challenge to issue
  the `*` cert; if it asks for a `_acme-challenge` TXT record, add it. A browser
  **cert warning** on a subdomain means the cert isn't issued yet (add the TXT,
  then Refresh; issuance takes a few minutes).

> `admin.` is added as its own (more specific) domain so it routes directly; the
> wildcard catches every other subdomain. Both point at the same project — the
> app's `src/proxy.ts` special-cases the `admin.` host and resolves all other
> subdomains to a company.

---

## 2. Supabase Auth — cross-subdomain SSO

Without this, subdomains load but **login bounces / doesn't persist across hosts**.
In the Supabase dashboard (Authentication → URL Configuration):

- [ ] **Site URL** = `https://neverthrowinthetowel.uk`
- [ ] **Redirect URLs** (allow-list) include:
  - `https://neverthrowinthetowel.uk/**`
  - `https://admin.neverthrowinthetowel.uk/**`
  - `https://*.neverthrowinthetowel.uk/**`  ← the wildcard covers every company portal
- [ ] **Auth cookie domain = `.neverthrowinthetowel.uk`** (leading dot). This is what
  makes one session valid across the apex, `admin.`, and every `{company}.` host —
  it matches the app's `cookieDomainForHost` (`src/lib/tenant/resolve.ts`). Set it
  where your Supabase project exposes the cookie/session domain for Auth.

> Post-auth, the app keys data off the user's own `profiles.company_id`, **not** the
> host they're on (`docs/ARCHITECTURE.md`, "Privacy boundary") — the host only
> drives *pre-auth* branding. So a member can log in on any host and still see their
> own company's data.

---

## 3. Production environment variables

Set these on the Vercel project (Settings → Environment Variables → Production).
Full annotated list: `.env.example` + `docs/LAUNCH_READINESS.md` ("Required prod env
vars"). The ones that matter for *this* restructure:

- [ ] **`NEXT_PUBLIC_APP_ROOT_DOMAIN=neverthrowinthetowel.uk`** — drives subdomain →
  slug extraction and the cross-subdomain landing bounces. (Code defaults to this,
  but set it explicitly.)
- [ ] **`NEXT_PUBLIC_SITE_URL=https://neverthrowinthetowel.uk`** — hard-fails
  login/signup/invite if unset.
- [ ] Supabase keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] `CRON_SECRET` (gates all cron jobs **and** the `/api/health?detail=1` probe),
  VAPID trio (push), `SUPPORT_ACK_TOKEN_SECRET`, Brevo + Twilio + fallback-contact
  vars — per the LAUNCH_READINESS checklist.
- [ ] **Confirm the Vercel plan is Pro** — the `*/15` support-monitor and push crons
  don't run on Hobby.

Verify config after deploy (does not expose any secret value — lists missing var
**names** only):

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  https://neverthrowinthetowel.uk/api/health?detail=1
# expect: {"status":"ok","database":"ok", ... "config":{"criticalOk":true, ...}}
```

---

## 4. Database — migrations + companies

From a machine with the Supabase CLI (full runbook: `docs/DEPLOYMENT.md`):

- [ ] **Migrations applied** — `supabase db push` (all migrations under
  `supabase/migrations/`). Verify RLS is on for every table.
- [ ] **Companies exist with the right slugs.** Either apply `supabase/seed.sql`
  (seeds **Amazon** `amazon` and **KP Snacks** `kp-snacks`), **or** create each
  company in-app via **Admin → Companies** (the wizard sets slug + branding and
  previews the live URL). Reminder: `seed.sql` is **not** run by `db push` — apply
  it separately (`psql … -f supabase/seed.sql` or the SQL editor).
- [ ] **First `ntitt_admin`** provisioned (DEPLOYMENT.md §3) so someone can reach the
  Control Tower.

> ⚠️ **Slug = subdomain, exactly.** `kp-snacks.neverthrowinthetowel.uk` shows the KP
> Snacks portal only because a company row has `slug = 'kp-snacks'`. A mistyped host
> (`kpsnacks`, no hyphen) resolves to *no* company and falls back to the default,
> NTITT-branded site with public signup shown — which is exactly the "looks wrong"
> symptom to watch for (see §7).

---

## 5. Auth email (Brevo SMTP)

Full runbook: **`docs/SMTP_SETUP.md`**. In short:

- [ ] Verify the **`ntitt.co.uk`** sender domain in Brevo (SPF / DKIM / DMARC DNS).
- [ ] Generate a Brevo **SMTP key** → set **`SUPABASE_AUTH_SMTP_PASS`** on the
  Supabase project (distinct from the REST `BREVO_API_KEY`).
- [ ] Run the 5-step delivery test (signup confirmation, magic-link, invite,
  recovery, email-change).

> Email sender stays `@ntitt.co.uk` even though the web app is on
> `neverthrowinthetowel.uk` — a deliberate product decision (`docs/SMTP_SETUP.md`).

---

## 6. Verification matrix (the acceptance tests)

Run these from a browser once §§1–5 are done. This is what "live" means — trust
these over any dashboard status label.

| Test | URL | Expected |
|---|---|---|
| Apex loads | `https://neverthrowinthetowel.uk` | Public marketing, valid 🔒 |
| Wildcard resolves | `https://anything.neverthrowinthetowel.uk` | App loads (default branding), valid 🔒 |
| Company portal branded | `https://kp-snacks.neverthrowinthetowel.uk` | **KP Snacks** logo/copy, **no** "Create account" |
| Control Tower | `https://admin.neverthrowinthetowel.uk` | Redirects to `/admin` → login |
| Config OK | `…/api/health?detail=1` (with `CRON_SECRET`) | `criticalOk: true` |
| Role landing — member | log in as `employee` | lands on `/home` |
| Role landing — HR | log in as `hr_admin` | lands on their company's `/workspace` |
| Role landing — admin | log in as `ntitt_admin` | lands on `admin.…/admin` |
| Cross-subdomain SSO | log in on one host, open another | still signed in (no re-login) |
| Staff first-run | log in as a **new** HR/NTITT admin | gets the short staff onboarding, not the member routine flow |

---

## 7. Troubleshooting

- **Subdomain shows default NTITT branding + a "Create account" link** → the host
  didn't resolve to a company. Either the `slug` doesn't match the subdomain label
  exactly, or that company isn't in the prod DB. Fix in **Admin → Companies** or via
  `seed.sql` (§4).
- **"Proxy Status Unknown" on the wildcard** → cosmetic (§1). If real subdomains
  load with a valid padlock, ignore it.
- **Browser cert warning on a subdomain** → the wildcard TLS cert isn't issued; add
  the `_acme-challenge` TXT record Vercel asks for, then Refresh (§1).
- **"Server not found" on a subdomain** → the `*` DNS record is missing (§1).
- **Login works but you're logged out when you switch hosts** → the auth cookie
  domain isn't `.neverthrowinthetowel.uk`, or the host isn't in the redirect
  allow-list (§2).

---

## Ownership

- **NTITT (dashboards/DNS):** §§1–5 — Vercel domains + wildcard, Supabase Auth +
  cookie domain, prod env vars, DB migrations/seed, Brevo SMTP.
- **Engineering:** done — the three-journeys code is merged (`PLATFORM_STRUCTURE.md`).
