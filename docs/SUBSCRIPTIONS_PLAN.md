# Subscriptions & Billing — Dev Plan

_Stripe-powered subscriptions for the NTITT platform. This is the spec the build PRs
reference. Status: **APPROVED — core decisions locked (§11). Ready to build Phase 1.**_

---

## 1. Scope & phasing

Two populations, two billing models. Build in two phases; design Phase 1 so Phase 2 slots
in without rework.

| Phase | Who | Model | When |
| --- | --- | --- | --- |
| **Phase 1 — B2C** | **Direct individuals** (self-service signups in "NTITT Direct", `DIRECT_COMPANY_ID`, role `employee`) | Each person pays for their own access, self-service | **Build now** |
| **Phase 2 — B2B** | **Partner-company members** (invited into a co-branded company, roles `employee`/`hr_admin`) | The **employer** pays a licensing fee; employees get access **free**. Sliding per-head, NTITT-HQ-managed, invoiced | **Design now, build later** |

**Non-negotiable design rule (prevents a launch-day disaster):** B2C gating must gate
**only Direct-company members**. Partner-company members and `ntitt_admin`s must **never**
be paywalled by B2C logic. Baked into the entitlement resolver (§4).

---

## 2. Phase 1 — B2C product & pricing spec

### Tiers

| Tier | Price | Access |
| --- | --- | --- |
| **Freemium** | Free | **"Get Support" button + Events page only** (+ read-only access to the user's own past data). Everything else → upgrade prompt. The fallback when someone doesn't subscribe / cancels / lapses. |
| **Pro** | **£27.00 / month** or **£291.60 / year** (10% off — 12 × £27 × 0.9) | **Full access** to every feature. |

- **7-day free trial of Pro — NO card required** (your decision). Implemented as an
  **app-level trial**: starting it grants a 7-day `trialing` entitlement in **our** DB —
  no Stripe object, no card. Zero friction to start, no abandoned Stripe trials.
- **To continue, the user adds a card via Stripe Checkout** → that's when the real Stripe
  subscription (£27/mo or annual) is created. A card is collected **only** at this point.
- **Trial ends with no card / cancel / failed payment → drop to Freemium** (never account
  deletion — they keep account + data, lose Pro features). We own `trial_end`, so we drive
  the "add a card before day 7" reminders.
- **One trial per user** (guarded) — no repeat trials after lapsing.
- Currency **GBP**, **flat £27.00 — no VAT** (NTITT isn't VAT-registered yet; no VAT line,
  no Stripe Tax. Revisit — likely enabling Stripe Tax — when you register). Monthly +
  annual; annual = 10% discount → **£291.60/yr**.

### What "full access" gates (the Freemium allowlist)

Freemium reaches **only**: the **Get Support** flow (safety-critical — never gate), the
**Events** page (view + book), and **read-only** access to the user's own past data
(GDPR-friendly). Everything else (Today board, routines, reviews, Library, Challenges,
Community, Journey, STAND, step/habit trackers, …) is **Pro-only** → Freemium users hitting
them see an **upgrade** page.

---

## 3. Phase 1 — data model

New tables (own migration, RLS, column-grant discipline, harness assertions updated).
Billing stays **out of `profiles`**.

### `billing_customers` (user ↔ Stripe customer map)
`user_id` (uuid PK → auth.users), `stripe_customer_id` (text unique), timestamps. One row
per Direct user once they reach Checkout.

### `subscriptions` (authoritative entitlement state)
| column | type | notes |
| --- | --- | --- |
| `id` | text PK | `stripe_subscription_id` for paid rows; a generated id for app-trial rows |
| `user_id` | uuid → auth.users | owner |
| `source` | text | `app_trial` \| `stripe` |
| `status` | text | `trialing` / `active` / `past_due` / `canceled` / `incomplete` / `unpaid` |
| `tier` | text | `pro` |
| `price_id` | text null | the Stripe Price (monthly/annual); null for app-trial |
| `stripe_subscription_id` | text null | null for app-trial |
| `current_period_end` | timestamptz null | paid period end; null for app-trial |
| `trial_end` | timestamptz null | trial expiry (app-trial or Stripe trial) |
| `cancel_at_period_end` | boolean | |
| timestamps | | |

- **Trials live here too:** an app-level trial is a row with `source='app_trial'`,
  `status='trialing'`, `trial_end` set, Stripe columns NULL. On conversion the **webhook**
  writes a `source='stripe'` row (status `active`). So the Stripe columns are **nullable**.
- **RLS:** a user may `SELECT` **their own** rows (read-only, for Settings). **All writes
  are service-role only** — both the webhook and the "start trial" server action write via
  the **service-role client**, so members have **no** write grant and entitlement stays
  tamper-proof (same discipline as `tc_agreed_at`).
- **One-trial guard:** a `profiles.trial_started_at` (or a check against existing trial
  rows) prevents a second trial.

### Phase 2 placeholder (not built now)
`company_subscriptions` keyed by `company_id` (stripe ids, seats, per-head price, status,
period). Phase 1 touches none of it.

---

## 4. Entitlement model — the heart of gating

One pure, server-side resolver; the single source of truth. Never trust the client or the
Checkout success redirect.

```
resolveEntitlement(profile, subscription?) -> "full" | "freemium"

1. role === "ntitt_admin"                         -> "full"   (staff)
2. company_id !== DIRECT_COMPANY_ID (partner)     -> "full"   (employer-paid; Phase 2
                                                               refines to read company_subscriptions)
3. Direct member — look at their subscription row:
     status "active"                              -> "full"
     status "trialing" AND trial_end in future    -> "full"   (covers the no-card app-trial)
     status "canceled" BUT current_period_end>now -> "full"   (paid through period end)
     otherwise                                    -> "freemium"
```

Rule 2 is the partner-safety guarantee. Enforcement is **server-side** (data-access layer /
route guards / an app-shell gate) with the Freemium allowlist explicitly permitted; gated
routes send Freemium users to the **upgrade** page.

---

## 5. Stripe catalog (Phase 1)

- **Product:** "NTITT Pro". **Prices:** `pro_monthly` (£27 GBP/mo), `pro_annual`
  (£291.60 GBP/yr). (No Stripe `trial_period_days` needed — the trial is app-level.)
- Freemium is **not** a Stripe object (= "no active subscription").
- Create in the **Stripe dashboard (test mode)**; store price IDs as env/config
  (`STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`). Mirror in live mode at go-live.

---

## 6. Phase 1 — integration flows

Hosted Checkout + Customer Portal keep us out of PCI scope.

### a) Start trial (no card) → convert to paid (Checkout)
- **Start trial:** server action grants a **7-day `trialing` app-trial** row via
  service-role (`trial_end = now + 7d`, tier `pro`) — no Stripe object, no card, honouring
  the one-trial guard. Full access immediately.
- **Convert to paid:** server action → **Checkout Session** (`mode:'subscription'`, chosen
  price, `customer` = existing-or-new mapped customer, `metadata.user_id`, success/cancel
  URLs) → redirect to Stripe. First and only point a card is collected. The webhook writes
  the authoritative paid row.

### b) Manage subscription — Customer Portal
Server action → **Billing Portal session** → redirect. Card updates, plan switch
(monthly↔annual), cancellation. Minimal UI for us.

### c) Webhook `/api/stripe/webhook` — authoritative state sync
Mirrors the existing signed-webhook pattern (`/api/auth/send-email`): **Node runtime**,
**raw body**, **signature-verified** against `STRIPE_WEBHOOK_SECRET`, **idempotent**,
service-role writes. Handle: `checkout.session.completed`,
`customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`.
**Entitlement is granted only here**, never from the browser redirect.

### d) Config / health
Add a **`stripe` group** to `src/lib/health/config.ts` (`STRIPE_SECRET_KEY`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, the two price IDs) so
`/api/health?detail=1` reports billing readiness like it does for email.

---

## 7. UX — "best experience"

- **Start trial:** one click, **no card**, instant full access.
- **Trial reminders (built, PR 6):** the 7-day trial is app-level (no Stripe subscription),
  so Stripe can't warn them — a daily cron (`/api/jobs/trial-reminders`, 09:00 UTC) emails
  every member whose `trial_end` is inside 2 days ("add a card to keep Pro, or you'll move to
  Freemium"), stamping `subscriptions.trial_reminder_sent_at` so no trial is emailed twice.
- **Convert:** a single Checkout (first time a card is asked). Upgrade page shows monthly
  vs annual (annual highlights the 10% saving).
- **Settings → Billing:** current plan, renewal date, "Manage billing" (Portal).
- **Dunning (built, PR 6):** a `past_due` member drops to Freemium while Stripe retries the
  card automatically. In-app we surface it where they land — Settings → Billing ("Payment
  needs attention" + Update payment) and the `/upgrade` paywall ("Your Pro access is paused"
  + Update your card, with the fresh buy buttons hidden so a retry can't spawn a second
  subscription). The failed-payment **emails are Stripe-native** (Dashboard → Billing →
  Customer emails) rather than re-implemented here — Stripe already owns retry timing and
  the card-update link, so one Dashboard toggle beats a parallel email path we'd have to keep
  in sync. Get Support stays reachable throughout.
- **Lapsed users keep their data** and can re-subscribe (no second free trial).

---

## 8. Existing Direct members at launch (your decision: grace + auto-trial + email)

At cut-over, a one-off migration/job grants **every current Direct member a 7-day Pro
app-trial** (`trialing` row, `trial_end = now + 7d`) and emails them to subscribe — so
nobody is suddenly locked out of features they use today. After their grace trial ends
without a card, they move to Freemium like anyone else.

---

## 9. Testing

- **Test mode** throughout (`sk_test_`/`pk_test_`/test price IDs) on Vercel **Preview**;
  **live** keys reserved for **Production** at go-live.
- **Stripe CLI** (`stripe listen --forward-to …/api/stripe/webhook`) for webhook testing;
  test cards for success/decline.
- **Test Clocks** to simulate renewals / failed renewals.
- Unit tests: entitlement resolver (incl. partner-safety + trial-expiry + one-trial guard),
  webhook idempotency; migration harness for the new tables/RLS/grants.

---

## 10. Build breakdown (incremental draft PRs — our usual cadence)

1. **Foundations** — `stripe` SDK, env wiring, `stripe` health group, price-ID config, docs. No user-facing change.
2. **Schema** — `billing_customers` + `subscriptions` tables, RLS, grants, one-trial guard, harness assertions.
3. **Webhook** — `/api/stripe/webhook` + service-role state sync + idempotency (source of truth; testable via Stripe CLI before any UI).
4. **Trial + Checkout + Portal** — start-trial action, Checkout convert, Billing Portal, entry points.
5. **Entitlement + gating** — resolver, server-side enforcement, Freemium allowlist (Get Support + Events + own read-only data), upgrade/paywall page.
6. **Trial & dunning UX** — trial-ending reminder cron (+ `trial_reminder_sent_at` idempotency), Settings `?billing=` banners, and the `/upgrade` past_due notice. Failed-payment emails are Stripe-native (Dashboard), not rebuilt here.
7. **Existing-member cut-over** — the grace auto-trial migration + notification email (run at launch).

Each small, fully verified (tsc/lint/tests/harness/build), draft PR, merged on your
"merge when green".

---

## 11. Decisions — RESOLVED

**Locked:**
1. **Trial = no card.** App-level 7-day trial (one click → full access, no Stripe object);
   card only at conversion via Checkout; we drive the reminders. ✅
2. **Existing Direct members = grace + auto-trial + email** at cut-over (§8). ✅
4. **VAT = none for now.** Flat **£27.00**, no VAT line, no Stripe Tax. Revisit on
   VAT registration. ✅
- Tiers: **Free + Pro**. Cadence: **monthly + annual (10% off)**. ✅

**Minor — default assumed, change anytime before PR 5:**
3. **Freemium allowlist:** Get Support + Events + **own data read-only**. _(assumed)_
5. **Annual price:** **£291.60/yr**. _(assumed)_
6. **Display:** "£27/mo" and "£291.60/yr — save 10%". _(cosmetic)_

---

## 12. Build prerequisites (env/Stripe, before/at PR 1)

- Stripe **test** keys on Vercel **Preview**: `STRIPE_SECRET_KEY` (test), add
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test). _(The key added to Production should be the
  **live** key at go-live; confirm the Production one isn't a test key.)_
- Create the two **test-mode Prices** in Stripe → capture `STRIPE_PRICE_PRO_MONTHLY` /
  `STRIPE_PRICE_PRO_ANNUAL`.
- `STRIPE_WEBHOOK_SECRET` comes after we register the webhook endpoint (PR 3).

---

_Phase 1 (B2C) is the build. Phase 2 (B2B) is designed-for and documented. Say the word and
I'll start PR 1 (Foundations) — it's low-risk and has no user-facing change._
