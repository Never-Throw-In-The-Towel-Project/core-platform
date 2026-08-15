# Auth email (SMTP) go-live runbook

_How to make invites, signup confirmations, magic-link sign-ins and password
resets actually deliver in production._

## Why this exists

The platform sends email from **two independent places**:

| Sender | What it sends | How it's configured | Status |
| --- | --- | --- | --- |
| **The app** (`src/lib/**`, `fetch` to Brevo's v3 REST API) | 90-day impact report, Ask-for-Support alerts, step-challenge notifications, Anthony-visit request | `BREVO_API_KEY` + `BREVO_SENDER_EMAIL` env vars | Works once those two vars are set |
| **Supabase Auth** (GoTrue) | Signup **confirmation**, **magic-link** sign-in, admin **invites**, password **recovery**, email-change | Supabase project SMTP settings / `supabase/config.toml` `[auth.email.smtp]` | **This runbook** |

Out of the box Supabase Auth uses Supabase's **built-in shared mailer**, which is
rate-limited to roughly **2 emails/hour** and is explicitly *not for production*.
Until custom SMTP is configured, a real client's day-one invite batch will
silently fail to deliver — which is why this is a launch blocker, not a polish item.

We route Auth email through **Brevo's SMTP relay** — the same vendor the app
already uses — so there is one sender identity and one verified domain to keep
healthy.

> **Sender domain decision:** the email domain stays **`@ntitt.co.uk`** even though
> the web app moved to `neverthrowinthetowel.uk`. So `ntitt.co.uk` is the domain
> that must be verified (SPF/DKIM) in Brevo. If that decision changes later, swap
> the domain in every step below and in `supabase/config.toml`.

---

## What's already in the repo

- `supabase/config.toml` → `[auth.email]`, `[auth.email.smtp]`,
  `[auth.email.template.*]`, `[auth.rate_limit]` — the version-controlled record of
  the intended production config. The SMTP password is `env(SUPABASE_AUTH_SMTP_PASS)`
  so no secret is committed.
- `supabase/templates/*.html` — branded confirmation / invite / magic-link /
  recovery / email-change emails.
- `.env.example` → `SUPABASE_AUTH_SMTP_PASS` (the Brevo **SMTP key**, distinct from
  the REST `BREVO_API_KEY`).

The steps below provision the live side. You can do it entirely in the **Supabase
dashboard** (fastest), or via `supabase config push` (keeps dashboard and repo in
sync). Both are described.

---

## Step 1 — Verify the sender domain in Brevo (DNS)

1. Brevo → **Senders, Domains & Dedicated IPs → Domains → Add a domain** → enter
   `ntitt.co.uk`.
2. Brevo shows DNS records to add at the `ntitt.co.uk` DNS host. Add all of them:
   - **DKIM** — a `TXT` (or `CNAME`, per Brevo's current instructions) record,
     e.g. host `mail._domainkey` / `brevo._domainkey`.
   - **SPF** — ensure the domain's `TXT` SPF record includes Brevo:
     `v=spf1 include:spf.brevo.com ~all` (merge into an existing SPF record; do
     **not** create a second SPF record).
   - **Brevo verification** `TXT` record (`brevo-code:...`).
3. **DMARC** (strongly recommended for deliverability) — add a `TXT` at `_dmarc`:
   `v=DMARC1; p=none; rua=mailto:dmarc@ntitt.co.uk` (start at `p=none` to monitor,
   tighten to `quarantine`/`reject` later).
4. Wait for propagation, then click **Verify** in Brevo until DKIM + domain show
   authenticated. Deliverability is poor until DKIM passes.
5. Decide the exact **from** address — this runbook and `config.toml` use
   `no-reply@ntitt.co.uk`. It only needs to be on the verified domain; a mailbox
   isn't required for a no-reply, but add a reply-to elsewhere if you want replies.

## Step 2 — Get the Brevo SMTP credentials

Brevo → **SMTP & API → SMTP**. Note:

- **SMTP server:** `smtp-relay.brevo.com`
- **Port:** `587` (STARTTLS)
- **Login:** the value Brevo shows (an 8-digit id or the account email) → this is
  `user` in `config.toml`.
- **SMTP key:** **Generate a new SMTP key** → this is `SUPABASE_AUTH_SMTP_PASS`.
  It is **not** the same as the v3 REST api-key used by `BREVO_API_KEY`.

## Step 3 — Configure Supabase Auth SMTP

**Option A — Dashboard (quickest):**

1. Supabase → **Authentication → Emails → SMTP Settings** → enable **Custom SMTP**.
2. Host `smtp-relay.brevo.com`, port `587`, username = Brevo SMTP login,
   password = Brevo SMTP key, sender email `no-reply@ntitt.co.uk`, sender name `NTITT`.
3. **Authentication → Emails → Templates** → paste the contents of each
   `supabase/templates/*.html` into the matching template, and set the subjects
   from `config.toml` (`[auth.email.template.*].subject`).
4. **Authentication → Rate Limits** → raise **"Emails per hour"** from the default
   to **30** (matches `config.toml`; raise further for large onboarding waves).

**Option B — `supabase config push` (keeps repo ↔ project in sync):**

1. In `supabase/config.toml`, set `[auth.email.smtp].user` to the real Brevo SMTP
   login (replace `SET_BREVO_SMTP_LOGIN`).
2. Export the secret in your shell: `export SUPABASE_AUTH_SMTP_PASS='<brevo-smtp-key>'`.
3. `supabase link --project-ref <ref>` (if not linked) then `supabase config push`.
4. Confirm the dashboard now shows Custom SMTP enabled and the templates applied.

> Keep the SMTP key out of git. It lives in the Supabase project (Option A) or your
> shell + secret manager at push time (Option B) — never in `config.toml`.

## Step 4 — Check the redirect allow-list

Invite/confirmation/magic-link links bounce through `/auth/callback` on
`NEXT_PUBLIC_SITE_URL`. Supabase only redirects to allow-listed URLs
(`[auth].additional_redirect_urls` / dashboard **URL Configuration**). Confirm the
site URL and every host the app redirects to after auth are listed — including any
per-company subdomains under `neverthrowinthetowel.uk` if those become post-login
landing targets. See `docs/DEPLOYMENT.md` §3.

## Step 5 — Test end to end

1. **Invite:** from `/admin/invite`, invite a real inbox you control → the branded
   "You've been invited to NTITT" email should arrive within seconds; accepting it
   lands on `/auth/callback` and provisions the profile at the right company/role.
2. **Signup confirmation:** sign up at `/signup` with a fresh address → "Confirm
   your NTITT account" arrives; the form shows "Check your email to confirm your
   account"; clicking confirms and lets you sign in.
3. **Magic link:** on `/login` request a sign-in link → "Your NTITT sign-in link"
   arrives and signs you in.
4. **Password reset:** trigger a reset → "Reset your NTITT password" arrives.
5. In Brevo → **Transactional → Logs**, confirm each send with DKIM pass. Send a
   test to a Gmail + an Outlook address and check it lands in the inbox, not spam.

## Troubleshooting

- **Mail lands in spam:** DKIM/SPF not passing, or DMARC absent — revisit Step 1.
- **`535` / auth error in Brevo logs:** wrong credential — you likely used the REST
  api-key instead of an **SMTP key**, or the wrong login.
- **Nothing sends but no error:** custom SMTP not actually enabled (still on the
  built-in mailer), or you hit the per-hour rate limit — check Step 3/4.
- **Links go to `localhost`:** `NEXT_PUBLIC_SITE_URL` is wrong on the deployment.
- **Local dev shouldn't send real mail:** set `[auth.email.smtp].enabled = false`
  in `supabase/config.toml` so `supabase start` uses the bundled Inbucket inbox
  (`http://localhost:54324`) instead of Brevo.
