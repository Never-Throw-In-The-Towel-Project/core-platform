# NTITT Platform — Architecture & Decisions

This is the durable record of the decisions made in planning, so they live
in the codebase rather than only in chat history. Update it when a decision
changes; don't let it drift from what's actually built.

## What this platform is

A daily wellbeing tool sold to companies as an employee wellbeing programme:
journaling, habit tracking, community, and video content, built around a
fixed weekly framework (Morning Routine, Mon–Fri themed check-ins, Night
Routine, Weekly Review, Sunday Setup, 30/90-Day Reviews). Two user types:
employee (end user) and company HR admin (aggregate dashboard only).

The one rule everything else is built around: **all personal check-in,
routine, and review data is private to the user only. The company dashboard
sees aggregate, anonymised data only — never individual answers, names, or
scores.** This is a technical constraint enforced in the data model, not a
policy enforced by application code discipline.

## Relationship to the existing Circle.so community — superseded

**Superseded decision, kept for history:** the original plan below (SSO/
deep-link bridge into Circle, no native community tables) has been reversed.
See "Core platform vs. co-branded portals" and "Community scope" below for
the current decision: **this platform builds its own native, NTITT-wide
community independently of Circle.** Circle is not the long-term home for
community/events — no bridge, no merge, no ongoing integration is planned.
Circle's eventual sunset timeline and whether any historical content is
worth carrying over are business decisions, not yet made, and don't block
building the native tables per the resolved schema below.

Original (Phase 1) reasoning, no longer current: Anthony already runs a live
Circle.so community at `ntitt.co.uk` (spaces, events, a mobile app, real
members and history). The original plan was to link to it (SSO/deep-link)
rather than build native community tables, revisiting consolidation only
once the platform was proven and paying.

"The STAND framework" (visible in Circle) is Anthony's philosophical
backbone, not the platform's structural identity — NTITT is the brand. STAND
can inform copy/framing (e.g. how check-in themes or content library tags
are described) but has no schema or IA implications.

## Core platform vs. co-branded portals — the unifying principle

Anthony's own framing, and the one every "company-specific vs. shared"
decision resolves against: **NTITT is the core platform. Co-branded portals
for flagship clients (KP Snacks, Amazon, etc.) are an overlay on that core,
never a fork of it.** The shared/core layer is the default and the primary
experience; anything company-specific is optional, additive, and layered on
top — visually (see "Multi-tenant / co-branded enterprise experience" above)
and socially (see "Community scope" below). Nothing about a co-branded
portal should require a different codebase, a different content library, or
a different community — only a different skin and an optional extra space.

## Community scope

Resolved in favour of the Full Platform Build Brief (v3.1)'s model over the
Website Spec's: **one shared, NTITT-wide community is the primary space, with
an optional company-only space alongside it** — not a fully siloed,
per-company community. This is the direct social expression of the
core-vs-portal principle above: the community *is* the core, shared
experience; a company-only space is the co-branded overlay on top of it.

**Schema/RLS model (resolved now, not yet implemented — see Roadmap):**
- One shared table set (`community_posts`, `community_wins`, etc.), not
  per-company-isolated tables. Each row carries a `scope` column:
  `'global' | 'company'`.
- RLS: `scope = 'global'` → readable by any authenticated user, platform-wide,
  regardless of `company_id`. `scope = 'company'` → readable only by
  same-`company_id` users, following the same pattern as every other
  company-scoped table in this schema.
- **Moderation is platform-level, not `hr_admin`.** A company's HR admin gets
  zero visibility into the cross-tenant feed's moderation queue — that's
  Anthony's/NTITT's remit, never a client's, for the same reason HR admins
  never see individual check-in data: scope of authority is a hard boundary,
  not a courtesy. This requires a third role beyond `employee`/`hr_admin` —
  `ntitt_admin` — added to the `user_role` enum, with its own RLS policies.
  `hr_admin`'s dashboard access must never imply any community moderation
  right.

This model is locked so the eventual migration is built right the first
time, not because Community has moved up in priority — see Roadmap.

## Build order

Website-first (PWA), not native app first — faster and cheaper, per the
Website Full Spec brief — but built PWA-capable (installable, push
notifications, offline-friendly for the daily forms) from day one, per the
Full Platform Build Brief's app-shaped UX (day counters, daily notifications).
A native app, if it's ever needed, becomes a thin wrapper rather than a
rewrite. See `src/app/manifest.ts`.

## Stack

- **Next.js 16 (App Router) + TypeScript**, deployed on Vercel. Note: Next 16
  renamed Middleware to Proxy (`src/proxy.ts`, not `middleware.ts` — same
  functionality). Proxy runs on the Node.js runtime in this version, not
  Edge, which is why it's safe to run a full Supabase auth check there
  rather than a cookie-presence-only optimistic check.
- **Supabase (Postgres + Auth)**. Row Level Security is the enforcement
  mechanism for the privacy boundary — see below.
- **Vimeo** (unlisted) for video hosting, embedded. Chosen over YouTube:
  domain-locked embeds, no ads, no "up next" algorithmic rail pulling
  someone away mid-video. This matters more than YouTube's free hosting
  given the podcast/guest-contributor consent process explicitly promises a
  right of withdrawal — a leaked "unlisted" YouTube link undermines that
  promise in a way Vimeo's stricter privacy controls don't.
- **Twilio + Brevo**, split by purpose, not one vendor for everything:
  - **Twilio** (SMS), dedicated solely to the Ask for Support alert. Direct
    API integration (fetch, no SDK yet), not Zapier — this is the one flow
    the brief calls a failure condition if it's slow ("if someone reaches
    out and nobody responds for hours, the system has failed"), so it gets
    the vendor whose entire business is real-time delivery confirmation and
    failover, not one where crisis alerting shares infrastructure with
    marketing sends.
  - **Brevo** for the CRM (corporate prospect/client management — Amazon, KP
    Snacks, etc.) and general transactional/engagement email. Consolidates
    3 vendors into 1 everywhere except the single highest-stakes path.
- **Zapier and other no-code glue**: fine for everything else (podcast RSS,
  content ops) — deliberately not used for the support alert path.

## Privacy boundary: how it's actually enforced

Personal data (`private` schema: `morning_entries`, `night_entries`,
`themed_checkins`, `sunday_setups`, `weekly_reviews`, `periodic_reviews`,
`support_requests`) vs. shared/aggregate data (`public` schema: `companies`,
`profiles`, `content_videos`, `company_support_counts`,
`company_daily_participation`, `company_review_completions`).

**Row Level Security is the real, hard boundary — not schema separation.**
An earlier draft of the migration also excluded `private` from Supabase's
exposed API schemas, on the theory that this was an additional layer of
protection. That was tested locally against a real Postgres instance and
reverted: our own Next.js server code reaches Postgres through the same
PostgREST/`authenticated`-role path as any other client (via
`@supabase/ssr`'s `createServerClient`), so hiding the schema from the API
blocks our own reads and writes too, not just outside access. `private` is
now included in `supabase/config.toml`'s exposed schemas, and RLS (`auth.uid()
= user_id`, no exceptions, no hr_admin policy anywhere on any private table)
is what actually does the work. This was verified locally: seeded two
employees and an HR admin against the real migration SQL, confirmed employee
A cannot see or spoof-insert as employee B, and HR admin gets zero rows on
every private table — see the migration file's header comment for the full
reasoning, and git history for the test transcript.

Sleep score (morning) and day rating (night) are the two fields the brief
singles out by name as never-reportable, even in aggregate. They live in
`private` like everything else, flagged in code comments as a standing
reminder not to add any column, view, or aggregate that surfaces them.

**Aggregation is one-way, `private → public`, and only ever written by
`service_role`** (which bypasses RLS by design — that's what makes it able
to compute cross-user rollups):
- `company_support_counts` is updated live by a `SECURITY DEFINER` trigger
  (`private.increment_support_count()`) on every `support_requests` insert.
- `company_daily_participation` / `company_review_completions` (% completed
  by day, most/least engaged day, 30/90-day completion rates): implemented in
  Phase 4 as a Vercel Cron job (`vercel.json`, daily at 02:00 UTC) hitting
  `src/app/api/jobs/aggregate-participation`, authenticated by a shared
  `CRON_SECRET` bearer token rather than a user session — this is the one
  route that reads across every user's private data via the service-role
  client. It processes "yesterday" (the most recent fully-settled day) each
  run: two admin-client reads (`public.profiles` for the company_id map,
  then the relevant `private`-schema completion rows for that date),
  aggregated in memory rather than a cross-schema join — a supabase-js query
  is scoped to one schema per request, so `public.profiles` and
  `private.morning_entries` can't be joined in a single query here.
  `company_review_completions` is populated as an all-time running total per
  `(company_id, review_type)` on a fixed sentinel `period_start`
  (`2000-01-01`), not a real per-period breakdown — each user's own
  `periodic_reviews.period_start` is personal (day-journey-based, see "Daily
  core loop" above), so there's no shared calendar period to bucket a
  company's cohort by the way daily participation has a shared `entry_date`.
  The brief's actual dashboard requirement here is just a completion count,
  which this satisfies.

No table or policy anywhere lets an HR admin's session query another user's
row. That's not "the policy denies it" — the grant simply doesn't exist.

**Bug found and fixed while starting Phase 4** (affected every private-table
query in Phases 1-3): `supabase/config.toml` exposing multiple schemas
(`public`, `private`, `graphql_public`) to PostgREST does not mean a client
searches across all of them. Per PostgREST/`postgrest-js`, a client that
doesn't explicitly select a schema always targets the default (`public`)
only. Every query against a `private`-schema table, across every phase, was
written as plain `.from("morning_entries")` etc. with no schema override —
meaning every one of them was actually querying `public.morning_entries`,
which doesn't exist, and would 404 against a real Supabase instance despite
RLS being correctly configured to allow it. This passed `tsc`/`lint`/`build`
in every phase because none of those touch the network — only an actual
PostgREST round-trip surfaces it, and Phase 1's RLS verification was done
directly against Postgres, not through this code path.

Fixed by making `createClient()` (`src/lib/supabase/server.ts`) and
`createAdminClient()` (`src/lib/supabase/admin.ts`) take a
`schema: "public" | "private"` parameter (default `"public"`), and updating
every call site that touches a `private` table to pass `"private"`
explicitly. A function touching both a `public` and a `private` table in the
same request (e.g. `submitSupportRequest` reading `companies` while writing
`support_requests`) now creates two client instances, one per schema. There
is no compiler check that catches a future call site forgetting this — it
depends on whoever adds a new private-table query following the pattern
already established at every existing call site.

## Multi-tenant / co-branded enterprise experience

Content and the check-in framework are identical for every company —
that's the "built once, runs everywhere" economics the whole model depends
on. Co-branding is a presentation-layer override on top:
- `public.companies` holds `logo_url`, `primary_color`, `accent_color`,
  `welcome_copy`, `slug` (subdomain), and an optional `custom_domain` for
  flagship clients.
- `src/lib/tenant/resolve.ts` resolves a request's Host header to a company
  (subdomain slug, e.g. `kpsnacks.ntitt.co.uk`, or a custom domain).
- `src/lib/theme/ThemeProvider.tsx` overrides four `--brand-*` CSS custom
  properties (defined with NTITT defaults in `globals.css`) per company.
  Every component should reference `--brand-*` tokens (Tailwind classes like
  `bg-brand-accent`), never hardcode a brand color directly.
- Scope note: the branding depth (logo+color theming vs. a fully distinct
  app identity/PWA name per client) is still open — the architecture
  supports either; only the amount of per-tenant design polish differs.
- **Important distinction**: the hostname-resolved company (via
  `resolveCompanyForHost`) is only used for *pre-authentication* branding
  (e.g. the login page's logo on a client's subdomain). Once a user is
  authenticated, the company that matters for data/routing purposes (Ask
  for Support routing, dashboard scoping) is always their own
  `profiles.company_id` — not whatever subdomain they happen to be on. Don't
  conflate the two.

## Ask for Support reliability design

Person-led only — never triggered by any journal answer or score. Flow:
`src/components/AskForSupport.tsx` (rendered in the `(app)` and `(admin)`
layouts, using the signed-in user's own `company_id`) → `src/lib/actions/
support.ts` (validates, inserts into `private.support_requests` under the
user's own RLS-scoped session) → `src/lib/support/alert.ts` (dispatches SMS
via Twilio and email via Brevo in parallel; one channel failing never blocks
the other, and both outcomes are recorded in `delivery_status`).

`src/app/api/webhooks/twilio-status/route.ts` receives Twilio's async
delivery-status callback (queued → sent → delivered/failed), verified via
Twilio's HMAC request-signing scheme so the endpoint can't be spoofed, and
records the confirmed status.

## Ask for Support hardening (Phase 5)

Three escalation paths, all landing on the same `escalateSupportRequest` in
`src/lib/support/alert.ts`, all targeting a **global NTITT fallback contact**
(`NTITT_FALLBACK_CONTACT_PHONE`/`_EMAIL` — Anthony/Craig, not the company's
own contact, since that's the one that just failed or went unanswered):

1. **Dispatch failure** — both SMS and email fail (or neither is
   configured) at the moment of submission. Escalates immediately, inline in
   `dispatchSupportAlert`, before the request even finishes processing.
2. **Delivery failure** — Twilio's async status callback confirms
   `failed`/`undelivered`. Only escalates if email didn't already succeed at
   dispatch time (`escalateOnDeliveryFailureIfNeeded`) — a confirmed-sent
   email means the contact has a real shot at seeing it even though SMS
   specifically failed, so this doesn't page the fallback contact on every
   partial SMS hiccup.
3. **Response-time monitoring** — `src/app/api/jobs/monitor-support-response-time`,
   a Vercel Cron job (every 15 minutes — this is why it's a separate cron
   from the once-daily aggregation job, and requires a Vercel plan whose
   cron scheduling supports sub-daily intervals). Escalates any request
   still `status = 'new'` past an urgency-specific timeout (`urgent`: 15
   min, `talk_today`: 4 hours, `check_in`: 24 hours — sane defaults, not yet
   a per-company setting; the brief calls for "agree a response protocol
   with each company before going live," which is a business step, not a
   technical one, this phase doesn't block on).

Every escalation path records its result in `delivery_status.escalation`
(reason, timestamp, per-channel outcome) and only ever escalates once per
request — a request that's already escalated for one reason doesn't get
re-paged by another trigger finding it later.

**"Mark as contacted" without a login**: there is no auth flow for company
support contacts, Anthony, or first-aiders as platform users — they're
contact info on `companies`, not rows in `profiles`. Every alert (SMS +
email) includes a token-signed link (`src/app/api/support-requests/[id]/ack`,
`generateAckToken`/`verifyAckToken` in `alert.ts` — same HMAC pattern as the
Twilio signature check, not a session) that flips `support_requests.status`
to `'contacted'`. This is what stops the response-time monitor from
escalating a request someone has actually already responded to — without
it, every request would eventually escalate regardless of whether a human
handled it, since nothing else in the codebase ever moves `status` off
`'new'`.

## Daily core loop (Phase 2): day-journeys vs. week-journeys

Resolved by CTO decision: the platform has two parallel time models, not
one, and every part of the daily/weekly framework is one or the other —
never a guess re-derived per feature.

- **Day-journeys** (Morning Routine, Night Routine, and the 30/90-Day Review
  milestones that will key off them in Phase 3): tracked by **active
  engagement**, not the calendar. "Day N" (`getDayCounter` in
  `src/lib/routines/dayState.ts`) counts distinct calendar dates on which
  the user completed at least a Morning or Night entry. A user who goes
  quiet for a week doesn't lose their place, but doesn't advance either.
  This is also the single source of truth the 30/90-Day trigger must read
  from in Phase 3 — it should never be recomputed differently there.
- **Week-journeys** (the five weekday themed check-ins, Sunday Setup,
  Weekly Review): pinned to the **real calendar week (Monday–Sunday)** —
  this is the accountability mechanic. There is no backfill: the themed
  check-in actions (`src/lib/actions/themedCheckin.ts`) derive "today" from
  the server clock, not a client-submitted value, so there is no field to
  submit a false day through. Miss Tuesday and that Tuesday's check-in is
  simply missed; Wednesday still only opens on the real Wednesday.

**Workout Wednesday** is a week-journey like its four siblings, so it was
built now in Phase 2 rather than deferred to Phase 4 (Content Library) as
originally scoped. Its rotating "workout of the week" (`workout_weeks` /
`workout_week_exercises`, see the Phase 2 migration) is keyed by real ISO
calendar week number modulo however many weeks are seeded
(`resolveBankPosition` in `src/lib/routines/dates.ts`) — every user sees the
same workout in the same real week, regardless of when they personally
started. Thoughts on Thursday's rotating quote bank (`daily_quotes`) follows
the identical rotation pattern. Both are seeded content tables rather than
hardcoded arrays, consistent with `content_videos`/`podcast_episodes` —
Anthony's content ops can add a new week/quote as a data insert, no
redeploy.

**Known simplification, not yet a decision**: all date/time resolution
(`src/lib/routines/dates.ts`) is UTC-based. There is no per-user timezone
column on `profiles` yet, so a user near a day boundary could see their
Morning/Night Routine or weekday check-in flip over at a UTC-relative
time rather than their actual local midday/7pm. Revisit once a timezone
column exists — see Open items.

## No day numbers, per Anthony's direct guidance

Superseding this doc's earlier framing (which called the active-engagement
count "Day N" and displayed it): **the platform never shows a user a day
number or streak count.** Anthony's reasoning, verbatim from planning:
missed days read as failure ("Day 47 sitting there when they've only
actually used it 20 times is demotivating"), and corporate users especially
drift in and out with shift patterns, holidays, and illness — a visible
count penalises exactly the dipping-in-and-out behaviour the platform is
supposed to tolerate gracefully. `getActiveDayCount`
(`src/lib/routines/dayState.ts`, formerly `getDayCounter`) still exists and
is still computed the same way (distinct calendar dates with a completed
Morning or Night entry) — it's purely an internal trigger input now, never
rendered. `MorningRoutineForm`/`NightRoutineForm` no longer take a
`dayNumber` prop at all.

This also sharpened the "dipping in and out" behaviour already built:
someone who comes back on a Thursday gets Thursday's content directly, no
forced catch-up, which is what Phase 2's no-backfill week-journey design
already did — Anthony's guidance confirms that was the right call, it
doesn't change it. The one refinement: **Feel Good Friday's "did you
achieve your goals from Monday?" question now only appears if Monday's
goals actually exist for that week** (`submitThemedCheckin` looks up the
real Monday row itself, same server-derives-the-truth pattern as the
weekday lock) — if Monday was skipped, Friday skips the goal-check
entirely rather than showing it empty or blocking completion on it.

A separate question Anthony's guidance raised: whether the 30/90-Day Review
trigger itself should move from active-engagement days to calendar days
elapsed since the user's start date (his message frames the corporate
offering as "4 x 90 day quarterly blocks... reviews trigger automatically at
30 and 90 days from each person's start date"). **Resolved: stays
active-engagement days**, confirmed rather than guessed at — a literal
calendar-day trigger would have worked against Anthony's own stated goal
here, since it could land a "congratulations" milestone on someone who
registered 90 days ago but barely used the platform, cutting against the
review's "recognise the effort you've made" framing more than the
active-engagement trigger does.

Individual-purchase product (a numbered physical journal, plus a streak
counter if a digital version of that product is ever built) is out of
scope — the current build is the corporate/company platform only.

## Roadmap

1. **Foundation** (this phase) — repo scaffold, auth, the privacy-boundary
   schema (validated against a real Postgres instance), tenant/branding
   resolution, CI.
2. **Daily core loop** (done) — Morning/Night Routine (day-journey, active-
   engagement day counter), Mon–Fri themed check-ins (week-journey, pinned
   to the real calendar week, with Monday→Friday goal linkage via
   `themed_checkins.goals`), Sunday Setup, including Workout Wednesday's
   rotating workout bank (see "Daily core loop" above — brought forward
   from Phase 4 since it's a week-journey like its siblings).
3. **Reviews & history** (done) — Weekly Review (`/weekly-review`, open
   Friday through the weekend, separate from Feel Good Friday), My
   Journey/History (`/journey`, read-only scroll-back through past Weekly
   and 30/90-Day Reviews), and the 30-Day/90-Day Review. The 30/90-Day
   trigger reads the exact active-engagement day counter Phase 2
   established (`getDayCounter`'s `completedDays`) via
   `getPendingPeriodicReview` in `src/lib/routines/periodicReview.ts` —
   never re-derived — and takes over the home screen as a full-screen
   moment (`src/app/(app)/home/page.tsx` redirects there before the normal
   morning/themed/night dispatch) until completed, per the brief calling
   the 30-day mark "the critical retention point" and the 90-day mark the
   one that "triggers the renewal conversation." `period_start` is the
   user's first-ever completed active day, `period_end` is whenever the
   30/90 threshold was actually reached — not fixed calendar quarters,
   since day-journeys aren't calendar-based. The 90-Day Review's PDF
   export (`/reviews/90-day/summary`) is a print-friendly page (browser
   "Save as PDF"), not a server-side PDF pipeline — deliberately different
   from Phase 6's HR impact report, which must generate and email itself
   unattended and will need a real PDF library then.
4. **Content Library** (done) — `/content`: browse and search
   `content_videos` by category (Mental Fitness, Physical Fitness, Tools &
   Tips) and by title/tag (`title.ilike`/`tags.cs` — search "divorce" or
   "addiction" and land on relevant content, per the brief), Vimeo-embedded
   via a lazy `<iframe>` (`src/components/VimeoEmbed.tsx` — starts as a
   lightweight "Watch" card, only mounts the real player once tapped, rather
   than loading every video's iframe on page load). **"Editable by Anthony
   without developer involvement"**: satisfied by Supabase Studio's table
   editor directly against `content_videos`/`workout_week_exercises`/
   `daily_quotes`/`podcast_episodes` — deliberately not a bespoke in-app CMS
   screen. The brief's requirement is that Anthony can add content without a
   developer, which Supabase's own dashboard already does; building a
   redundant internal tool for what's effectively spreadsheet-equivalent
   data entry isn't work this phase needs to do. Revisit only if Anthony
   finds the raw table editor genuinely unworkable in practice.
   Workout Wednesday's own demo-video linking already landed in Phase 2.
   The private→public aggregation job (participation/review completion
   stats, needed for the dashboard to be meaningful) also lands here — see
   "Aggregation is one-way" above.
5. **Ask for Support hardening** (done) — escalation-on-failure logic,
   response-time monitoring. See "Ask for Support hardening (Phase 5)"
   above.
6. **Company Dashboard** — full aggregate reporting, auto-generated 90-day
   impact PDF (server-side generation — see Phase 3's note above on why
   that one can't reuse the print-friendly approach).
7. **Community (native)** — shared NTITT-wide feed + optional company space,
   built on the resolved `scope`-column schema and `ntitt_admin` moderation
   role (see "Community scope" above). No Circle bridge. Sequencing is
   unchanged from the original plan, for reasons that still hold: the daily
   core loop, reviews, and content library are what make this a sellable,
   pilot-ready product to HR — the parts Circle has no answer for — while
   Circle already provides a live substitute for community today, so there's
   no unmet need pulling it forward. A shared feed is also more useful, and
   safer to moderate, once an active user base exists to populate it with
   check-ins, wins, and reviews. Only the *model* moved up (locked now to
   avoid a painful migration later, once the daily-loop tables already
   exist) — not the build order.

## Open items (business decisions, not blocking Phase 1)

- Exact co-branding depth for flagship clients (cosmetic vs. full app
  identity).
- Whether there's a fixed pilot deadline (e.g. KP Snacks) driving sequencing.
- Real NTITT brand colors/logo/PWA icon assets — `--brand-accent` and
  `public/icon-*.png` are placeholders right now (see `globals.css` and
  `src/app/manifest.ts`).
- Circle.so's sunset timeline and whether any of its historical content
  (STAND framework, Talking Tuesdays, Members Events posts/history) is worth
  carrying over — platform builds independently either way; this only
  affects Circle's own wind-down, not the native community schema.
- Per-user timezone: `profiles` has no timezone column yet, so all
  day/week-journey boundaries (Morning/Night Routine cutover, which weekday
  check-in is "today") are resolved in UTC — see "Daily core loop" above.
- ~~Whether the 30/90-Day Review trigger should be calendar-days-since-start
  rather than active-engagement days~~ — **resolved**: stays
  active-engagement days, confirmed. Calendar-based would risk landing the
  "congratulations" milestone on someone who registered 90 days ago but
  barely engaged, cutting against the review's own "recognise the effort
  you've made" framing. See "No day numbers, per Anthony's guidance" above.
- Whether "Week 1 / Week 4 / Week 12" framing (Anthony's suggested corporate
  vocabulary, replacing day numbers) needs to surface anywhere in the
  product — e.g. the Company Dashboard's participation trend (Phase 6) — or
  is purely how the offering gets described commercially to HR, with no UI
  implication. Not yet needed since Phase 6 isn't built.
