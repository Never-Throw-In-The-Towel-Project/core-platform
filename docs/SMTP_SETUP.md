# Auth email go-live runbook

_How to make invites, signup confirmations, magic-link sign-ins and password
resets deliver in production — branded, from our own domain._

## Why this exists

Every email the platform sends now goes through **one branded system**: the
shared layout in `src/lib/email/` (`renderBrandedEmail`) and the single Brevo
transactional sender (`src/lib/email/brevo.ts`). There are two _triggers_, but
one look and one sender:

| Trigger | What it sends | How |
| --- | --- | --- |
| **The app** | Guest event booking, Ask-for-Support alerts, step-challenge notices, 90-day impact report | Renders the branded layout, sends via Brevo REST (`BREVO_API_KEY` + `BREVO_SENDER_EMAIL`) |
| **Supabase Auth** (GoTrue) | Signup **confirmation**, **magic-link** sign-in, admin **invites**, password **recovery**, **email-change** | The **Send Email hook** → `src/app/api/auth/send-email` → same branded layout + Brevo REST |

Out of the box Supabase Auth uses Supabase's built-in shared mailer (~2 emails/hour,
"powered by Supabase" footer, not for production). Enabling the **Send Email hook**
replaces that: GoTrue hands each auth email to our endpoint, which renders it from
the app's branded layout and sends it via Brevo — so auth mail matches every other
NTITT email and comes from the same sender. This retires the older SMTP-relay route
(kept, disabled, as a fallback in `config.toml`).

> **Sender:** `Never Throw In The Towel <no-reply@neverthrowinthetowel.uk>`. That
> domain is **already authenticated in Brevo** (SPF/DKIM/DMARC — "Authenticated ·
> Branded"), so deliverability is set; the steps below only wire the hook.

---

## What's already in the repo (code — done)

- `src/lib/email/brevo.ts` + `src/lib/email/layout.ts` — the shared sender + layout.
- `src/app/api/auth/send-email/route.ts` — the hook endpoint (verifies the signed
  request against `SUPABASE_AUTH_HOOK_SECRET`, renders the branded email, sends via
  Brevo).
- `src/app/auth/confirm/route.ts` — the on-domain token-hash verify landing the
  branded auth links point at.
- `src/lib/auth/authEmailContent.ts` — the branded copy for each auth email.
- `supabase/config.toml` → `[auth.hook.send_email]` (enabled, URI + secret) and the
  now-disabled `[auth.email.smtp]` fallback.
- `.env.example` → `SUPABASE_AUTH_HOOK_SECRET`.

## Go-live: two steps (project side)

Everything below is **project/hosting configuration** — no code changes.

### Step 1 — Create the Send Email hook secret + enable the hook

**Dashboard (quickest):** Supabase → **Authentication → Hooks → Send Email** →
**Enable** → type **HTTPS** → URI `https://neverthrowinthetowel.uk/api/auth/send-email`
→ **Generate secret**. Copy the generated `v1,whsec_…` value.

_Or_ via `supabase config push`: `[auth.hook.send_email]` is already in
`config.toml`; export `SUPABASE_AUTH_HOOK_SECRET` and push.

### Step 2 — Set the secret on the app deployment

Set the **same** `v1,whsec_…` value as `SUPABASE_AUTH_HOOK_SECRET` on the Vercel
project (Production + Preview) and redeploy. The endpoint rejects any request it
can't verify with this secret, so the hook won't work until both sides match.

That's it — the domain is already verified and `BREVO_API_KEY` / `BREVO_SENDER_EMAIL`
are already set, so branded auth mail flows the moment the hook is on.

## Step 3 — Check the redirect allow-list

Branded auth links land on **`/auth/confirm`** (token-hash verify) on
`NEXT_PUBLIC_SITE_URL`; magic-link/OAuth may also use `/auth/callback`. Supabase only
redirects to allow-listed URLs (**URL Configuration** / `[auth].additional_redirect_urls`).
Confirm the site URL and every post-login host — including per-company subdomains
under `neverthrowinthetowel.uk` — are listed. See `docs/DEPLOYMENT.md` §3.

## Step 4 — Test end to end

1. **Magic link:** `/login` → request a sign-in link → "Your sign-in link" arrives,
   branded, from `no-reply@neverthrowinthetowel.uk`; clicking signs you in via
   `/auth/confirm`.
2. **Invite:** `/admin/invite` a real inbox → "You're invited to Never Throw In The
   Towel" arrives; accepting provisions the profile at the right company/role.
3. **Signup confirmation:** `/signup` with a fresh address → "Confirm your account"
   arrives; confirming lets you sign in.
4. In Brevo → **Transactional → Logs**, confirm each send with DKIM pass; test a
   Gmail + an Outlook address and check inbox, not spam.

## Troubleshooting

- **Auth emails don't send after enabling the hook:** the secret differs between
  Supabase and the app deployment (the endpoint returns 401), or
  `SUPABASE_AUTH_HOOK_SECRET` isn't set on Vercel. Both must be the exact
  `v1,whsec_…` value.
- **Signup/sign-in errors with "error sending confirmation email":** the hook
  endpoint returned non-200 — check Vercel logs; usually a Brevo error
  (`BREVO_API_KEY`/sender) surfaced deliberately so GoTrue reports it.
- **Mail lands in spam:** DKIM/SPF/DMARC — but the domain shows Authenticated in
  Brevo, so check the specific message's Brevo log.
- **Links go to `localhost`:** `NEXT_PUBLIC_SITE_URL` is wrong on the deployment.
- **Turning the hook off (fallback):** re-enable `[auth.email.smtp]` in
  `config.toml`, provision the Brevo SMTP key (`SUPABASE_AUTH_SMTP_PASS`), and the
  `supabase/templates/*.html` files render as the fallback. Local `supabase start`
  that shouldn't send real mail: keep the hook/SMTP disabled to use Inbucket
  (`http://localhost:54324`).
