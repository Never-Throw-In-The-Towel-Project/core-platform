# Platform Structure — three journeys, three hosts

Status: **largely built.** Phases 0–1.5 shipped (PRs #88 / #92 / #93 + the content
Studio); Phase 2 is done bar HR onboarding; Phase 3 is in progress. This is the
reference for how the platform is organised by *who you are*. It supersedes the
ad-hoc role-link structure described in earlier docs.

### Build status (updated 2026-08-15)

- ✅ **Live:** the **Control Tower** (`/admin/*`, one layout-level
  `requireNtittAdmin`), the **Company Workspace** (`(company)/workspace/*`), and
  **role-aware cross-subdomain landing** (`src/lib/auth/landing.ts`). The five
  admin surfaces are relocated with 301s (`next.config.ts`).
- ✅ **All Phase 3 code shipped:** step-route disambiguation
  (`/challenge` → `/step-challenge`), hiding Direct members' "My Company",
  role-aware HR/NTITT onboarding, and the content **edit** action are done. The
  only thing left is the Phase 0 infra below (NTITT dashboards, not code).
- **Naming decided:** the singular step-challenge route is now **`/step-challenge`**
  (was `/challenge`; permanent redirect in place) to end the one-letter collision
  with the `/challenges` programmes. The admin authoring surface **stays
  `/admin/challenges`** — the `/admin/programmes` rename shown in the tables below
  was dropped, because its motivating ambiguity (`/admin` meaning both the HR
  dashboard and NTITT admin) is already resolved by the `/workspace` move, and the
  rename would only split naming from the member-facing `/challenges`.
- ⚙️ **Remaining (NTITT dashboards, not code):** the Vercel `admin.` + `*.`
  wildcard domains and the Supabase redirect-allow-list / cookie-domain config
  (Phase 0 ops) — the go-live gate for the subdomain hosts. **Full operator
  tick-list: `docs/INFRA_GO_LIVE.md`.**

## Why

Today the platform has three *roles* (`employee`, `hr_admin`, `ntitt_admin`)
but not three *sites*: the NTITT admin tools are buried inside the member app
(under `/community/admin/*`), the HR dashboard's route group is confusingly
named `(admin)`, everyone lands on `/home` regardless of role, and each NTITT
admin page self-guards per-page (a fail-open risk if a new page forgets).

This plan separates the platform into **three clean journeys**, each keyed to a
host, so the experience matches the person.

## The three journeys

| Host | Who lands here | Journey | Serves |
|---|---|---|---|
| **`neverthrowinthetowel.uk`** (+ `app.`, `www.`) | Public visitors · Direct members | **The Core** | public marketing + the member wellbeing app (NTITT-branded) |
| **`{company}.neverthrowinthetowel.uk`** | Partner staff · their HR | **The Company** | the member app (company-branded) + the HR cockpit |
| **`admin.neverthrowinthetowel.uk`** | NTITT team only | **The Control Tower** | content authoring, moderation, company management — `ntitt_admin` only |

The member app deliberately appears on both the Core and Company hosts — same
code, branding switched by host (`resolveCompanyForHost`). HR live entirely on
their company subdomain; they never touch `admin.neverthrowinthetowel.uk`.

## Decisions (locked)

1. **Separate subdomains** (not path prefixes, not separate apps).
2. **HR = monitor/analytics only** — HR sees aggregate dashboards and runs step
   challenges; content is 100% NTITT-curated and identical for everyone. No
   company content-curation surface, no company "groups" model. (Additive later
   if wanted.)
3. **Open public signup** — anyone can self-register on `neverthrowinthetowel.uk` and use
   the full member app (the "Direct" cohort). No tiering/entitlements.
4. HR cockpit is named **"{Company} Workspace"**, at `/workspace`.
5. NTITT admin site is **"NTITT Admin"**, at `admin.neverthrowinthetowel.uk`.
6. Direct members do **not** get a "My Company" community space (it would pool
   unrelated strangers); real companies keep theirs.

## URL / route structure

One app, so paths are globally unique. The two admin surfaces get distinct
prefixes; this also removes the old `/admin`-means-two-things ambiguity.

| Prefix | Journey | Role | Notes |
|---|---|---|---|
| `/`, `/what-i-do`, `/documentary`, `/podcast`, `/privacy`, `/terms` | Core (public) | anon | `(marketing)` group, unchanged |
| `/home`, `/content`, `/journey`, `/settings`, routines, reviews, `/community/*` | Core/Company (member) | any member | `(app)` group, unchanged (admin links removed from header) |
| **`/workspace/*`** | Company (HR) | `hr_admin` | renamed from `(admin)/dashboard`; real sub-nav: Overview · People · Challenges · Reports |
| **`/admin/*`** | Control Tower | `ntitt_admin` | new `src/app/admin/` tree with a layout-level guard |

### Control Tower (`/admin/*`) — relocations

| Today | Becomes |
|---|---|
| `(app)/community/admin/content` | `/admin/content` (Content Studio) |
| `(app)/community/admin/challenges(/[id])` | `/admin/challenges(/[id])` (kept "challenges", not "programmes" — see Build status) |
| `(app)/community/admin` (moderation) | `/admin/moderation` |
| `(app)/community/admin/podcast-guests` | `/admin/podcast` |
| `(app)/admin/invite` (create company + invite) | `/admin/companies` + `/admin/people` |

Old URLs 301 → new URLs so nothing breaks.

## The three mechanisms

1. **Host → journey routing** (proxy): add `admin` to `RESERVED_SUBDOMAINS`; on
   the `admin.` host require `ntitt_admin` at the edge *and* the `/admin` layout;
   company hosts brand by host (already works). Once domains are live, a
   host-rewrite lets `admin.neverthrowinthetowel.uk/*` serve the `/admin/*` tree at clean
   root URLs, and lands HR on `/workspace`.
2. **Role-aware landing** (auth callback): after login, branch on role —
   `ntitt_admin` → `admin.neverthrowinthetowel.uk`, `hr_admin` → `/workspace`, `employee` →
   `/home`. (Today everyone lands on `/home`.)
3. **Cross-subdomain SSO** (infra + code): set the Supabase auth-cookie domain to
   `.neverthrowinthetowel.uk` so one session is valid across all three hosts; attach
   `admin.neverthrowinthetowel.uk` + wildcard `*.neverthrowinthetowel.uk` in Vercel. **Hard prerequisite
   for the subdomain model.**

## Company management — self-serve, zero-tech onboarding (Control Tower centrepiece)

Because the app resolves host→company from the DB at request time, and the
**`*.neverthrowinthetowel.uk` wildcard** (set up once) makes every subdomain resolve
automatically with auto-SSL, **creating a company row = a live branded portal**,
with no DNS/Vercel/deploy step per company. NTITT onboards partners with no
engineering support.

`/admin/companies` becomes a proper self-serve console:

- **"New Company" wizard**: type the name → slug + **live portal-URL preview**
  auto-generate ("live at **kpsnacks**.neverthrowinthetowel.uk"), with uniqueness +
  reserved-word checks; upload a logo + pick brand colours (live preview);
  enter the **HR admin's email** → on submit, the company is created **and** the
  first HR admin is invited by email, in one step.
- **Companies console**: list every company (portal URL, HR admins, status);
  **edit** (rebrand, support contacts, resend HR invite, deactivate). Closes the
  "no company editor" gap — today it's create-only.

**Exception:** a vanity custom domain (e.g. `wellbeing.kpsnacks.com`) inherently
needs a one-time DNS + Vercel handshake per client (`companies.custom_domain`
already supports it). The standard `{slug}.neverthrowinthetowel.uk` portal is instant and
code-free. *(Open: support vanity domains at launch, or defer.)*

## Access model

Roles stay additive and mutually exclusive at the admin tier. The restructure
hardens enforcement: the `/admin` tree gets a **layout-level `requireNtittAdmin`**
(one guard for the whole Control Tower) instead of per-page guards — closing the
fail-open risk. Private wellbeing data stays own-rows-only in the `private`
schema; no admin role ever reads it. HR see only one-way `company_*` aggregates.

## What moves / what's new / what's dropped

- **Moved (bulk, mechanical):** NTITT admin pages → `/admin/*`; HR → `/workspace/*`.
- **New (small):** the `/admin` shell + layout guard + nav; the `/workspace`
  sub-nav + HR onboarding; the Company-management wizard + console; a content
  **edit** action (today create/delete only); role-aware landing; proxy host
  rules; disambiguate the step route (`/challenge` → `/step-challenge`) from the
  `/challenges` programmes.
- **Dropped (by decision):** HR content-curation surface, company "groups"
  model, tiering/entitlements.

## Phased migration (each phase independently shippable + green)

- **Phase 0 — Infra foundation** *(mostly ops, some code)*: Vercel domains
  (`admin.` + `*.` wildcard); Supabase auth redirect allow-list for the
  subdomains; Supabase cookie domain `.neverthrowinthetowel.uk` (code, prod-only); reserve
  the `admin` subdomain. Verify SSO across hosts.
- **Phase 1 — Control Tower**: create `src/app/admin/` + guarded layout + nav;
  relocate the five admin surfaces (301s from old URLs); strip admin links from
  the member header. *Delivers Anthony's separate admin site + fixes the
  fail-open risk.*
- **Phase 1.5 — Company management**: the self-serve wizard + console.
- **Phase 2 — Company site**: rename `(admin)` → `(company)`; `/workspace`
  sub-nav; HR onboarding; land HR on `/workspace`.
- **Phase 3 — Core polish**: role-aware landing (✅); step route disambiguated
  (✅ `/challenge` → `/step-challenge`); Direct "My Company" hidden (✅);
  role-aware HR/NTITT onboarding + layout gate (✅); content-edit action (✅).

## Ownership split

- **NTITT (dashboard tasks):** Vercel domains + wildcard; Supabase auth redirect
  URLs. (Phase 0.)
- **Engineering (code):** everything else.
