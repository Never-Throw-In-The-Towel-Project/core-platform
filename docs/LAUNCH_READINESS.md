# Launch Readiness

_Assessment date: 2026-08-14. Method: a four-dimension read-only audit of the
codebase — content population, onboarding & first-run, operational config, and
compliance/legal/polish. This is the punch-list to get from "feature-complete"
to "a real client's staff can use it on day one."_

## Executive summary

The platform is **engineering-solid**: clean code (no TODO/FIXME/console.log in
`src`), strong accessibility, a sound RLS privacy boundary, fail-closed cron
auth, branded error boundaries, and graceful empty states almost everywhere.

The launch gaps are **not** in the core product — they cluster in three areas:

1. **Operator & admin tooling / onboarding** — there is no in-app way to create a
   client company or the first super-admin, and admins can't reach their own
   surfaces on mobile. A launch currently needs an engineer in the database.
2. **Legal / compliance** — for a UK product holding health-adjacent data there is
   no privacy policy, terms, signup consent, or in-product data rights (GDPR).
3. **Content & operational config** — the catalogue ships empty with no in-app
   edit/delete, and a set of prod env vars / a Vercel-Pro dependency must be
   provisioned or safety-critical email/SMS/escalation silently no-ops.

Each item below is tagged by **owner**: 🛠️ _Build_ (a code change we make),
⚙️ _Configure_ (prod env / infra the operator sets), 📝 _Provide_ (content or
legal copy only NTITT can supply).

---

## Launch-blocking

### Operator & admin tooling / onboarding
- 🛠️ **Admins can't reach admin surfaces on mobile.** The only links to the HR
  dashboard, Studio, Moderation, and Invite are `md:inline`-hidden in
  `AppHeader.tsx:57-73`; `BottomNav` has no admin entry. On a phone an HR admin
  has no route to their own dashboard. (Product is otherwise mobile-first.)
- 🛠️ **No company-creation surface.** No `companies` insert exists in `src`;
  `InviteStaffForm` only picks from existing companies. Onboarding a new client
  needs hand-written SQL. → a super-admin "create company" form.
- 🛠️/⚙️ **First `ntitt_admin` is chicken-and-egg.** `inviteStaffMember` requires an
  existing super-admin and none is seeded. → a documented bootstrap (seed row or
  a one-off script) + a checklist entry.
- 🛠️ **Push is never prompted in onboarding.** `PushNotificationToggle` is
  Settings-only; a user sets reminder times in onboarding, is never asked to
  grant push, and receives zero reminders. The whole reminder loop hinges on this.
- 🛠️ **Timezone is never captured in onboarding** (defaults `Europe/London`). Wrong
  day-phase and reminder timing for non-UK users. _(Drops to nice-to-have if the
  first launch is UK-only.)_

### Legal / compliance (📝 needs NTITT's copy; 🛠️ we build the surface)
- **Privacy policy / data-processing notice** — none exists; UK GDPR requires one
  before collecting data.
- **Terms of Service** — none exists.
- **Signup consent** — `SignupForm` captures name/email/password with no consent
  checkbox and no link to terms/privacy.
- **In-product GDPR rights** — Settings has no account deletion (Art. 17) or
  personal-data export (Arts. 15/20).

### Content & operational config
- 🛠️ **No edit / unpublish / delete for content items.** Only `createContentItem`
  exists; a wrong Vimeo ID or theme can only be fixed via raw SQL — and a live
  error message already tells admins to "edit it" on a screen that doesn't exist.
- 🛠️ **Vimeo IDs are unvalidated free text** → a mistyped ID renders a broken
  player on the member watch page with no fallback.
- 📝 **The catalogue ships empty.** No seeded content/challenges; the headline
  search-first Library is barren on day one. Needs a real launch catalogue loaded.
- ⚙️ **Provision prod env vars** (full list below). Several **silently no-op** when
  unset and disable safety-critical email/SMS/escalation with no signal.
- ⚙️ **Confirm Vercel plan is Pro** — the `*/15` support-monitor and push crons do
  not run on Hobby (once-daily cap), silently.
- ⚙️ **Configure Supabase Auth SMTP** — invites/magic-links ride Supabase Auth
  email, which has no SMTP block in `config.toml`; bulk day-one invites may not
  deliver.
- 🛠️ **Two unguarded hard-fail paths crash instead of degrading:**
  `NEXT_PUBLIC_SITE_URL` throws uncaught on login/signup/invite if unset
  (`auth.ts:48`, `signup.ts:66`, `invite.ts:9`); the VAPID keys throw *unguarded*
  and crash the entire push cron on the first due notification (`sendPush.ts:39`,
  job `route.ts:108`).
- 🛠️ **No observability** — no error tracking (Sentry/equiv.) and no `/api/health`
  on a safety-critical support-escalation flow. A failing/silently-skipping cron
  is invisible unless a human reads Vercel logs.

### Required prod env vars (⚙️ the config checklist)
Hard-fail if unset: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, VAPID trio
(`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
Silently degrade but disable a launch-critical feature: `CRON_SECRET` (all jobs
401), `SUPPORT_ACK_TOKEN_SECRET` (support ack→monitor loop), `BREVO_API_KEY` /
`BREVO_SENDER_EMAIL` (all email), Twilio trio (support SMS),
`NTITT_FALLBACK_CONTACT_PHONE` / `_EMAIL` (the "nobody responded" safety net).
Feature-optional: `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` (AI Studio assist),
`ANTHONY_VISIT_NOTIFY_EMAIL` (visit reward), `HELPLINE_NUMBER` (defaults to
Samaritans), `NEXT_PUBLIC_APP_ROOT_DOMAIN`.

### SEO / discoverability (🛠️)
- **No Open Graph / Twitter tags and no `metadataBase`** — sharing any link yields
  a bare text preview.
- **No `robots.ts` / `sitemap.ts`** — nothing guides crawlers.

---

## Nice-to-have (post-launch or fast-follow)

- 🛠️ Branded `not-found.tsx` (currently Next's unstyled 404) and a `loading.tsx`.
- 🛠️ Bulk/CSV import for the initial content load + challenge-day sequencing (the
  single biggest content-ops time sink; hours → minutes).
- 🛠️ `/api/health` endpoint for uptime monitoring; central cron failure alerting.
- 🛠️ Per-page titles + `title.template` (every marketing page shares one `<title>`);
  an `opengraph-image`.
- 🛠️ Gate provisional rank names on `rank.confirmed` (`ProgressBand.tsx:39` renders
  unapproved names; the `confirmed` flag is never checked) — or get names signed off.
- 🛠️ "Day 0 · Week N" reads oddly for a brand-new user (`home/page.tsx:281`).
- 🛠️ HR admins get the employee-framed onboarding and land on `/home`, not
  `/dashboard`; the onboarding gate isn't enforced on `(admin)` routes.
- 🛠️ Onboarding Sunday time is labelled "Optional" but the input is `required`.
- 🛠️ Dashboard shows no headcount until the first cron aggregation runs.
- ⚙️ Stagger `aggregate-step-challenges` off the shared 02:00 slot; tighten the
  support monitor toward the 15-min SLA. Fix `.env.example` drift (add
  `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`/`ANTHONY_VISIT_NOTIFY_EMAIL`, drop the
  unused `VIMEO_ACCESS_TOKEN`). Add an error check to the silent `pending` query
  in `monitor-support-response-time`.
- 🛠️ Cosmetic content: duration/thumbnails never captured; challenge day-picker
  lists drafts unfiltered.
- 🛠️ Optional cookie notice (low urgency — no third-party tracking found).

---

## Already solid (no action needed)

Cron→route wiring (all 5 jobs scheduled, 1:1) and cron auth (fail-closed,
constant-time, no unauthenticated job route); Twilio webhook HMAC verification;
branded `error.tsx` + `global-error.tsx` with the crisis helpline; accessibility
(exemplary crisis dialog, labelled forms, ARIA nav); PWA manifest + favicons;
no third-party trackers; empty states across Today/Journey/Community/Wins/
challenge/dashboard degrade cleanly; recorded-consent flows for podcast guests
and community/challenge opt-in; the RLS privacy boundary between personal data
and employer aggregates. Code hygiene is clean.
