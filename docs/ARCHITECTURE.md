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

**Schema/RLS model (implemented Phase 7):**
- One shared table set (`community_posts`, `community_comments`,
  `community_likes`, `community_reports`), not per-company-isolated tables.
  Posts/comments carry a `scope` column: `'global' | 'company'`. `board`
  (`'feed' | 'wins'`) distinguishes the main feed from the dedicated Wins
  Board on the same table, since they're structurally identical content.
- RLS: `scope = 'global'` → readable by any authenticated user, platform-wide,
  regardless of `company_id`. `scope = 'company'` → readable only by
  same-`company_id` users, following the same pattern as every other
  company-scoped table in this schema. Comments denormalize `scope`/
  `company_id` from their parent post (set once at insert by the server
  action, never changes) so their own RLS doesn't need a cross-table join.
- **Moderation is platform-level, not `hr_admin`.** A company's HR admin gets
  zero visibility into the cross-tenant feed's moderation queue — that's
  Anthony's/NTITT's remit, never a client's, for the same reason HR admins
  never see individual check-in data: scope of authority is a hard boundary,
  not a courtesy. This required a third role beyond `employee`/`hr_admin` —
  `ntitt_admin` — added to the `user_role` enum in its own migration/
  transaction (`20260731020000_add_ntitt_admin_role.sql`), split from the
  tables/policies that reference it (`20260731030000_phase7_community.sql`):
  Postgres forbids using a newly-added enum value in the same transaction
  that added it. `hr_admin`'s dashboard access never implies any community
  moderation right — no policy anywhere in the Phase 7 migration references
  `role = 'hr_admin'`.
- `ntitt_admin` accounts are provisioned manually via Supabase Studio (same
  pattern as Phase 4's content ops), not through any in-app flow. Since
  `profiles.company_id` is `NOT NULL` and NTITT staff aren't an employee of
  any client company, an `ntitt_admin` profile needs a dedicated internal
  `companies` row (e.g. "NTITT (internal)") created once via Studio, purely
  to satisfy that constraint — their RLS policies are never scoped by it.
  Direct/public members are a separate case, and are self-service now (see
  "Direct/self-service signup" below) — they're not invited, and they land
  in a different shared `companies` row ("NTITT Direct") from NTITT's own
  internal staff row.

**Author display names needed a real fix, not a workaround**: `profiles`
only has a self-read RLS policy (Phase 1, deliberate — no role has ever
been granted visibility into another user's profile row). `display_name`
is the one column the brief explicitly means to be community-facing, so
resolving an author's name for a post/comment the viewer is already
independently authorized to see (via `community_posts`/`_comments`' own
RLS) uses the service-role admin client (`getDisplayNames` in
`src/lib/community/queries.ts`), narrowed to selecting only `id,
display_name` and never exposed to the browser. This doesn't widen what a
client can query — `profiles`' RLS is untouched — it's the server
rendering the one field the model already intends to be visible, for
content the viewer is already allowed to see. The podcast guest list
(`/community/admin/podcast-guests`) and the moderation queue's "reported
by" name use the same justified exception, on the same reasoning as the
Phase 6 HR admin email lookup.

**Photo posts, scoped down deliberately for this phase**: the brief calls
for "text and photo posts." Real upload (a file picker → Supabase Storage
→ signed URL) needs a browser-side Supabase client, a storage bucket, and
bucket-level policies — none of which exist anywhere in this codebase yet
(every prior phase has been server-only), and storage behaviour is
notoriously environment-dependent, so it's not verifiable without a live
project the way everything else in this build has been. `community_posts.
image_url` is a plain optional URL field for this phase — the composer
lets someone paste a link to an already-hosted image, which renders inline
if present. This is an honest, working interim (not a silent scope cut,
and not a fake "upload" that doesn't actually upload anywhere) — a real
upload pipeline is a documented follow-up, not forgotten scope.

This model was locked in a prior session specifically so the eventual
build wouldn't need a painful migration once these tables existed — see
"No day numbers" section's confirmation of this same principle.

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
- **`@react-pdf/renderer`** for the 90-day HR impact report (Phase 6) —
  pure-JS PDF generation, no headless browser/Chromium, so it runs fine as a
  normal Vercel serverless function on the Node runtime.

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

## Rail redesign: day numbers shown again, optional this-week catch-up

Both reversed, deliberately, when the "Modernist" design pass introduced the
Rail-layout Today screen (see the conversation this shipped from) — flagged
back to Anthony rather than silently implemented either way, since both
supersede a decision this doc had previously called settled twice over.

**"Day N · Week N" is shown again**, directly superseding "No day numbers"
above. `getActiveDayCount` is unchanged — same active-engagement count, same
role as the 30/90-Day trigger's source of truth — it's just rendered on the
Rail now (`src/app/(app)/home/page.tsx`) instead of suppressed. "Week N" is
the real ISO calendar week number (`getIsoWeekNumber`), not a
personal week-since-joining count, consistent with week-journeys already
being pinned to the real calendar week rather than each user's own start
date.

**This-week catch-up is now allowed for the five weekday check-ins**,
reversing the no-backfill design directly above and its reaffirmation in
"No day numbers". The reasoning behind both earlier calls was specifically
about *forced* catch-up reading as failure/debt (a visible backlog,
guilt-inducing framing) — not that missed content had to become permanently
unreachable. The Rail resolves that by keeping catch-up strictly optional
and quiet:

- Today's own check-in never blocks on earlier missed days in the same
  week — completing Friday's doesn't require touching Tuesday's or
  Wednesday's.
- Missed days from earlier in the *current real week* stay reachable,
  worded plainly ("Also open this week: Tuesday's check-in") — no missed
  count, no streak break, no guilt language.
- Nothing carries past Sunday. The week-journey boundary is unchanged, only
  "gone the instant the day ends" is relaxed to "gone at the end of the
  week" — Monday starts clean regardless of what was left undone.

Mechanically: `catchUpEligibleWeekdays` (`src/lib/routines/dates.ts`)
computes, from the server clock and the user's own timezone, every Mon-Fri
weekday that has "opened" in the current real week (Monday through today,
or the full Mon-Fri set once the weekend arrives). `submitThemedCheckin`
and `submitWorkoutWednesday` (`src/lib/actions/themedCheckin.ts`) now accept
an optional `weekday` field and validate it against that same function
server-side, falling back to today's own weekday when the field is absent —
so a client can request any day that's genuinely open in the real current
week, but there is still nothing to submit that reaches a future day or a
different week. This preserves the original property the no-backfill
design was protecting (nothing to lie about to fabricate a day) while
dropping the part that made a missed day unreachable forever.
`getOutstandingWeekdaysThisWeek`/`getThemedCheckinCompletionThisWeek`
(`src/lib/routines/dayState.ts`) are the read-side equivalent, driving the
Rail's catch-up list and weekly tracker from one query.

Individual-purchase product (a numbered physical journal, plus a streak
counter if a digital version of that product is ever built) is out of
scope — the current build is the corporate/company platform only.

## Full codebase review (post-Phase 5)

A deliberate pass over everything merged so far, ahead of Company Dashboard.
One serious functional bug, plus three smaller hardening fixes:

- **Every `/api/*` route was unreachable in production.** `src/proxy.ts`'s
  fail-closed matcher intercepted all paths except a small `PUBLIC_PATHS`
  allowlist, and `/api/*` was never on it or excluded from the matcher. The
  Twilio status webhook, both Vercel Cron jobs, and the Ask for Support ack
  link are all called by something with no Supabase session (Twilio, Vercel's
  cron runner, an anonymous SMS/email link tap) — every one of them was
  silently redirected to `/login` instead of reaching its handler. This has
  been broken since Phase 1's Twilio webhook; `tsc`/`lint`/`build` can't catch
  it since it's request-routing behaviour, not a type or syntax issue. Fixed
  by excluding `api/` from the proxy's matcher entirely (see `src/proxy.ts`)
  — every existing `/api` route already authenticates itself independently
  (Twilio request signing, a `CRON_SECRET` bearer token, or a signed ack
  token), so none of them needed proxy-level gating in the first place. If a
  future `/api` route ever needs a real user session, gate it explicitly
  inside that route, not by removing this exclusion.
- **Filter-string injection** in two places that built a PostgREST `.or()`
  filter by directly interpolating external input: the Content Library
  search (`src/app/(app)/content/page.tsx`, user-typed query) and tenant
  resolution (`src/lib/tenant/resolve.ts`, the request's Host header). A
  value containing a comma or parenthesis could break out of the intended
  filter and inject an extra condition — not classic SQL injection (PostgREST
  parses this itself), and low real impact today since neither
  `content_videos` nor `companies` holds sensitive data, but the wrong
  pattern to have anywhere since it's exactly what would matter if ever
  copied onto a sensitive table. Fixed by wrapping the interpolated value in
  double quotes (PostgREST's documented escape mechanism) and escaping any
  literal quotes in the input first.
- **Open redirect** in `/auth/callback`: the `next` query param (where to
  send someone after login) was used in a redirect with no validation that
  it was a same-origin path. Fixed with `isSafeRedirectPath`
  (`src/lib/auth/redirect.ts`, shared with the login action below) — only a
  path starting with a single `/` is honoured.
- **The post-login redirect never actually worked**: `next` was set on the
  `/login` redirect by `proxy.ts`, but `signInWithMagicLink` never read or
  forwarded it into the magic link's `emailRedirectTo`, so every login
  landed on `/home` regardless of what page was originally requested. Fixed
  by threading `next` through the login page → `LoginForm` (hidden field) →
  `signInWithMagicLink` (validated with the same `isSafeRedirectPath`) →
  `emailRedirectTo`'s own `next` query param, which `/auth/callback` already
  read correctly.
- **Minor precision fix**: the 90-Day Review's habit-completion summary
  (`getHabitSummary`) undercounted themed check-ins from the first partial
  week, since `periodStart` (the user's actual first active day) can fall
  mid-week while `themed_checkins.week_start_date` is always a Monday.
  Widened the lower bound to that week's Monday.

All verified with `tsc --noEmit`/`lint`/`build` after every fix; the proxy
and redirect fixes in particular can't be verified that way (they're
request-routing/runtime behaviour) — flagged for real verification once
there's a live Supabase + deployed instance, same as every other
not-yet-live-tested item in this doc.

## Company Dashboard (Phase 6)

Full aggregate reporting per the brief, all from `src/lib/dashboard/aggregates.ts`
against the three public aggregate tables Phase 1 scaffolded
(`company_support_counts`, `company_daily_participation`,
`company_review_completions`) — nothing under `(admin)` reaches into
`private`, same invariant as before. Aggregate functions take a Supabase
client as a parameter rather than creating their own, since they're used in
two different auth contexts: the RLS-scoped session client for the
dashboard/on-demand export (an hr_admin reading their own company's rows),
and the service-role admin client for the day-90 auto-report cron job (no
user session to scope to there).

- **Weekly participation**: `company_daily_participation` rows bucketed by
  the Monday of each `entry_date`, giving a per-week % for morning/night/
  themed-check-in segments.
- **Most/least engaged weekday**: summed from the `themed_checkin` segment's
  `weekday` column (the only segment that carries one) across all recorded
  data.
- **Participation trend** (rising/falling/steady): compares the most recent
  week's average completion rate across all three segments to the week
  before it, with a ±5-point band counted as "steady" so it doesn't react
  to single-week noise.
- **Review completion**: read directly from `company_review_completions` —
  see its "all-time running total" design in the Phase 4 section above.

**The 90-day HR impact report** ("make it look professional — it needs to
work as a standalone document in a board meeting without Anthony being in
the room") uses real server-side PDF generation: **`@react-pdf/renderer`**
(pure JS, no headless browser/Chromium — a real dependency addition,
deliberately different from Phase 3's print-a-webpage approach for the
user's own 90-day summary, which only works because a logged-in person is
there to click print). `src/lib/reports/ImpactReportDocument.tsx` defines
the layout; `generateImpactReportPdf.tsx` renders it to a `Buffer`.
Smoke-tested directly (`renderToBuffer` against both a minimal document and
the full report with synthetic data) since this is pure rendering logic,
independently verifiable without a live Supabase instance — unlike almost
everything else in this codebase.

Two ways to get the report:
1. **On-demand**: `/api/reports/impact`, gated by `requireHrAdmin()` inside
   the route itself. This is the one `/api` route that *does* need a real
   user session — see the exception noted in `src/proxy.ts`'s comment.
2. **Automatic at day 90**: `src/app/api/jobs/generate-90-day-impact-reports`,
   a daily Vercel Cron job. "Day 90" for a company is 90 calendar days since
   `companies.created_at` — there's no other "company start date" concept
   in the schema, and unlike the per-user 30/90-Day Review (deliberately
   active-engagement based, see "Daily core loop" above), a company-wide
   milestone is reasonably calendar time since onboarding: the report covers
   a fixed quarter of the subscription regardless of how many individual
   employees engaged, which is exactly the "here's your impact this
   quarter" conversation this report exists to trigger. Sent via Brevo with
   the PDF as an attachment (`sendImpactReportEmail` — extends the existing
   Brevo integration with attachment support) to every `hr_admin` on the
   company, looked up via `auth.admin.getUserById` since an HR admin's email
   lives on their `auth.users` row, not on `profiles`/`companies` (Ask for
   Support's `support_contact_email` is a different, not-necessarily-same
   contact — see "Ask for Support reliability design" above).
   `companies.ninety_day_report_sent_at` gates this to once per company; a
   failed send (or no HR admin provisioned yet) leaves it `null` so the next
   day's run retries rather than silently losing the report.

## Brand assets: real NTITT logo and partner logos

Anthony supplied the real NTITT logomark and 8 partner/client logos via
`NTITT Logos/` at the repo root. This work replaces the placeholder PWA
icons flagged since Phase 1 and puts the real brand mark in front of users
for the first time.

- **Source logomark**: `NTITT-LOGOMARK-OUTLINE-TRANS.png` — a clenched-fist
  mark, black outline + white fill, transparent background, 2048×2048.
  Pure black/white — it carries no color information, so it doesn't resolve
  the `--brand-accent` placeholder (see Open items).
- **PWA icons** (`public/icon-192.png`, `public/icon-512.png`,
  `src/app/apple-icon.png`, `src/app/favicon.ico`) are generated from the
  logomark composited onto `#0a0a0a` — the same `background_color`/
  `theme_color` already declared in `manifest.ts` — so the black outline
  recedes and only the white fist reads, at every icon size down to 16px.
  Generated once via Pillow (`pip install Pillow`; not otherwise a project
  dependency) rather than committing a build step, since these are static
  brand assets that only change when the source logo changes.
  `src/app/apple-icon.png` uses Next's file-convention auto-detection
  (App Icons — `app/apple-icon.png` → `<link rel="apple-touch-icon">`)
  rather than living in `public/`, per `node_modules/next/dist/docs/.../
  app-icons.md` (this Next version's docs are the source of truth per
  `AGENTS.md`, not prior training data).
- **In-app logo** (`public/logo-mark.png`): a transparent (no composited
  background) crop of the same source, used on the marketing landing page
  and the login page since both already sit on `--brand-background`
  (`#0a0a0a`) — no separate light-mode variant exists yet because the app
  has no light theme.
- **Partner logos** (`public/partners/*.png`): all 8 files from
  `NTITT Logos/` were identified (two had non-descriptive filenames —
  confirmed by opening them: `Screenshot-2025-08-06-120827-300x111.png` is
  Amazon, `images-1.jpeg` is Vanlove) and normalized to PNG. Rendered on
  the marketing page's new "Trusted by" strip inside white chips, since the
  source files are a mix of transparent PNG, opaque PNG, and JPEG with
  their own (mostly light) backgrounds — a white chip is the one
  presentation that reads correctly for all of them without editing each
  logo's actual pixels.
- **Not done**: seeding these 8 logos as real `companies.logo_url` values
  for co-branded portals — that's a business decision (are these actual
  paying co-branded clients, or past partners/media mentions being shown
  on the public site) rather than an asset question, so it's left as an
  Open item rather than guessed at.
- **Also not done**: provisioning a real Supabase project or a Vercel
  deployment. Both were requested alongside the logo work, but neither is
  achievable from this environment — no Supabase or Vercel account access
  or API tooling is available here. That's a capability gap, not a code
  change, so it's tracked as an Open item rather than worked around.

## Community photo upload (Phase 9)

Replaces the pasted-image-URL interim from Phase 7 with a real upload
pipeline, per that phase's own note that `community_posts.image_url` was
"ready for a real upload pipeline (Supabase Storage) later without a
further migration" — this only needed a Storage bucket + policies, not a
schema change.

- **Bucket**: `community-images`, created via
  `20260731040000_phase9_community_photo_storage.sql` as `public: true`,
  with a 5 MiB `file_size_limit` and an `allowed_mime_types` allowlist
  (JPEG/PNG/WebP/GIF) enforced at the bucket level, in addition to the
  application-level checks in `src/lib/community/imageUpload.ts`.
- **Why public-read**: post photos are shown to every viewer the post's own
  `scope` column already allows (RLS on `community_posts` itself is the
  real visibility boundary, same as before). A public bucket is no more
  exposed than the arbitrary pasted URLs it replaces — anyone with the
  exact URL could already view those.
- **Why the real boundary is the upload policy, not the read policy**: the
  `storage.objects` INSERT/DELETE policies restrict a user to their own
  `{auth.uid()}/...` folder prefix via Supabase's standard
  `storage.foldername()` pattern — checked again here since dry-run
  validating this class of policy against a real Postgres instance is
  possible (unlike RLS's own runtime behavior, which needs a live
  PostgREST round-trip — see "Privacy boundary" above), by stubbing
  `storage.buckets`/`storage.objects`/`storage.foldername()` to mirror
  Supabase's real shape.
- **Upload flow**: no browser-side Supabase client exists in this codebase
  (every prior phase is server components + server actions only) — rather
  than introduce one, `submitCommunityPost` (`src/lib/actions/community.ts`)
  accepts the photo as a `File` straight off the `FormData` a Server Action
  already receives, uploads it server-side via the request-scoped session
  client (so the upload runs as the user's own `auth.uid()`, subject to the
  same RLS-equivalent Storage policies as any other client), and stores the
  resulting public URL. `next.config.ts`'s
  `experimental.serverActions.bodySizeLimit` raised from the 1MB default to
  `6mb` to fit a photo plus multipart overhead — `imageUpload.ts`'s own 5MB
  cap is the real enforced limit.

## Per-user timezone (Phase 9)

Replaces the UTC-only simplification flagged since Phase 1: every day/week-
journey boundary (Morning/Night Routine cutover, which weekday check-in is
"today", the Sunday Setup/Weekly Review gates) was resolved in server UTC,
so a user near a date boundary could see their "morning" flip over at a
UTC-relative time rather than their own local midday/7pm.

- `profiles.timezone` (migration `20260731050000_phase9_profile_timezone.sql`)
  — a plain `text` column, not validated against a fixed enum at the
  database level (Postgres doesn't track valid IANA zone names natively).
  Defaults to `'Europe/London'`. Validated where it's actually set — the
  `/settings` page's `updateTimezone` action
  (`src/lib/actions/settings.ts`) constructs an `Intl.DateTimeFormat` with
  the submitted value and rejects it if that throws, rather than
  maintaining a hardcoded list.
- **`src/lib/routines/dates.ts` now takes an explicit `timeZone` on every
  function, with no default.** This mirrors the design lesson from the
  Phase 1-3 schema-parameter bug (see "Privacy boundary" above): a
  timezone parameter that silently defaulted to the wrong value at a
  forgotten call site is the same shape of risk, so every call site must
  say explicitly which zone it means. `zonedParts()` (new, internal) uses
  `Intl.DateTimeFormat` with the `timeZone` option to read the real
  calendar date/hour/weekday for an instant in any IANA zone, with no new
  npm dependency.
- **User-facing call sites** (Morning/Night entry writes, the themed
  check-in weekday lock and `week_start_date`, Sunday Setup's Sunday gate,
  Weekly Review's Friday-onwards gate, the home screen's phase dispatch,
  the 30/90-Day Review's `period_start`/`period_end`) all now pass the
  caller's own `profile.timezone`.
- **System/cross-user call sites deliberately pass `"UTC"` explicitly,
  not a personal timezone** — because they either bucket many users' data
  into one company-wide aggregate, or select shared content that must be
  identical for every user in the same real calendar week:
  - `src/lib/dashboard/aggregates.ts` and the daily aggregation cron
    (`src/app/api/jobs/aggregate-participation/route.ts`) — bucketing
    every company's participation into weeks needs one consistent
    definition of "week," not each user's own. The cron's *target dates*
    are still UTC, but because each private `entry_date` is stored in the
    user's own timezone, a single "yesterday-UTC" pass would undercount
    western users whose local day hadn't closed yet at 02:00 UTC. The job
    therefore re-aggregates a trailing window of recent UTC days
    (`AGGREGATION_WINDOW_DAYS`, currently 3): the participation upsert is
    idempotent per `(company, entry_date, segment)` and recomputes each
    count from source, so once a date has settled in every timezone
    (within ~26h of UTC midnight) a later run overwrites the earlier
    partial count. See `recentUtcDates` in `src/lib/routines/dates.ts`.
  - `src/lib/routines/workouts.ts`'s `getWorkoutForWeek`/`getDailyQuote` —
    already documented as "every user sees the same workout in the same
    real week regardless of when they personally started"; using each
    user's own zone could flip different users onto different rotating-
    bank positions on the same calendar day near a week boundary.
  - The HR impact report (`collectImpactReportData.ts`) and its PDF
    filename (`generate-90-day-impact-reports/route.ts`) — a system
    timestamp for a company-wide report, not any one user's local day.
- **`/settings`** (new page): the only place a user can view/change their
  own timezone today — there's no signup flow yet that asks for one (see
  Open items), so every new profile starts on the `'Europe/London'`
  default until they visit this page.
- Sanity-checked the new zone-aware date math directly (not just type-
  checked) via `npx tsx` against real cross-zone cases — e.g. the same
  instant resolving to a Saturday in UTC/Los Angeles but already Sunday in
  Auckland, and the ISO Monday-of-week/first-Tuesday-of-month logic
  producing the same answers as before for a fixed zone.

## Minimal automated tests (Phase 9)

No test framework existed anywhere in this codebase before this — every
prior phase was verified by `tsc`/`lint`/`build` plus manual smoke tests
(directly running a script via `npx tsx`, screenshotting a page, hitting a
route by hand). That caught real bugs before (the `/api` proxy bug, the
CSS cascade-layer bug that silently defeated the whole brand theme), but
only because those checks happened to go looking in the right place each
time — nothing forced it. This phase adds a floor under the two classes
of bug that `tsc`/`lint`/`build` structurally cannot catch (they never
execute the logic, just check that it compiles):

- **Vitest** (`vitest.config.mts`, `npm test`) — chosen over Jest for
  zero-config ESM/TS support in a Next.js project with no existing test
  setup to work around. Added to CI (`.github/workflows/ci.yml`) between
  the Typecheck and Build steps.
- **`src/lib/routines/dates.test.ts`** — the timezone-aware date math from
  this same phase, including the actual cross-zone case that motivated the
  whole rewrite (the same instant resolving to different calendar days in
  different zones), not just the same-zone cases `tsc` would have let pass
  silently either way.
- **`src/lib/supabase/filterEscape.test.ts`** — the PostgREST filter-
  injection escaping found and fixed during the post-Phase 5 codebase
  review. The escaping logic was previously duplicated inline at both call
  sites (`src/lib/tenant/resolve.ts`, `src/app/(app)/content/page.tsx`);
  extracted into a shared `escapeFilterValue()` so there's one implementation
  to test rather than two to keep in sync by hand.
- **Deliberately not covered here**: RLS policy behavior (needs a live
  PostgREST round-trip against a real or stubbed Postgres instance — see
  the migration dry-run validation approach used throughout Phase 8/9
  instead, which exercises the actual policies, just not from an automated
  test file yet) and anything requiring a live Supabase session. This is a
  floor, not full coverage — worth expanding opportunistically, not in one
  pass.

## Push notifications (Phase 9)

The last piece of the "installable, push-capable" PWA promise `manifest.ts`
has claimed since Phase 1. `profiles.morning_notification_time`/
`night_notification_time`/`sunday_notification_time` have existed since
Phase 1 with nothing reading them; this is what finally makes them mean
something. Explicitly a build-it-or-defer decision, not something started
speculatively — confirmed with the team before starting since it's a
meaningfully sized feature (a migration, a service worker, a scheduled
dispatch job, permission-prompt UX), not a quick add.

- **`public.push_subscriptions`** (migration
  `20260731070000_phase9_push_notifications.sql`) — one row per browser
  subscription (`endpoint`/`p256dh`/`auth`, the standard Web Push
  subscription shape), globally unique on `endpoint` (a push endpoint
  identifies a specific browser subscription, not a user) and RLS-scoped
  to `auth.uid() = user_id`, same placement reasoning as `profiles` itself:
  a device identifier tied to account settings, not journal-style content,
  so `public`, not `private`.
- **`public.push_notification_log`** — dedup for the dispatch cron: one row
  per (user, notification type, local calendar date) actually sent, via a
  unique constraint the cron relies on rather than any in-memory tracking.
  No RLS policies at all (matching the existing convention for the
  service-role-only aggregate tables) — `service_role` bypasses RLS
  entirely, so none are needed for legitimate access, and enabling RLS with
  zero policies means zero access for every other role.
- **`src/lib/routines/dates.ts` gained `localMinutesSinceMidnight`** —
  the same `zonedParts()` internals as the rest of Phase 9's timezone work,
  now also extracting minutes, so the dispatch job can compare "is it
  currently this user's configured notification time, in their own
  timezone" without a new date library.
- **`/settings`** gained a push notification toggle
  (`PushNotificationToggle.tsx`): requests Notification permission,
  registers `public/sw.js` (a plain, unbundled service worker — outside the
  Next.js/TS build pipeline on purpose, since a service worker must be
  served as-is at the root scope to control every page), subscribes via
  `PushManager`, and hands the subscription to `subscribeToPush`
  (`src/lib/actions/pushSubscription.ts`) to store.
- **`src/app/api/jobs/send-push-notifications`** (new Vercel Cron, every 15
  minutes — matching `monitor-support-response-time`'s granularity, the
  other sub-daily job) — for each of the three notification types, reads
  every profile with that time set, checks whether the user's current local
  time (via their own `profile.timezone`) falls in the same 15-minute
  bucket as their configured time, and if so tries to insert today's dedup
  log row before sending — a unique-constraint failure there means it
  already went out this run/day, so it's skipped rather than double-sent.
  Actual delivery goes through `src/lib/notifications/sendPush.ts`
  (`web-push`), which deletes a subscription on a `404`/`410` response
  (the browser unsubscribed or cleared site data) but leaves it alone for
  any other error, since a transient failure shouldn't delete a
  subscription that might work again on the next run.
- **`VAPID_SUBJECT`** (new env var, `.env.example`) — `web-push`'s own
  VAPID validation requires the subject to be a `mailto:` address or an
  `https:` URL; `NEXT_PUBLIC_SITE_URL` couldn't be reused for this since its
  local-dev value (`http://localhost:3000`) is neither.
- **Not done**: an actual VAPID keypair. `.env.example`'s
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` are still blank
  placeholders — generate a real pair (`npx web-push generate-vapid-keys`)
  once the real Supabase/Vercel deployment exists, and set them in Vercel's
  Production environment alongside everything else in
  `docs/DEPLOYMENT.md`.

## Co-branding depth (Phase 10)

Confirmed with the team, not guessed at — three previously-open business
decisions:

- **Brand color: monochrome, not a placeholder waiting on a hex value.**
  The real NTITT brand is black and white, matching the logomark itself
  (which carries no color information either way). `--brand-accent` in
  `globals.css` changed from the placeholder red (`#dc2626`) to
  near-white (`#f5f5f5`, matching `--brand-foreground`), so CTA buttons
  read as a light chip against the dark background — the same visual
  language the logomark and the marketing page's "Trusted by" strip
  already used. Added a paired `--brand-accent-foreground` token
  (`#0a0a0a`) for text/icons sitting on an accent-colored background,
  since a fixed `text-white` no longer contrasts against a light accent —
  every one of the 24 `bg-brand-accent` usages across the codebase now
  pairs with `text-brand-accent-foreground` instead.
- **Co-branding depth: Amazon and KP Snacks specifically get real
  co-branded portals; the other 6 partner logos (ALDI Australia, Barbour,
  L'Oréal, Lighthouse Charity, The Hill Group, Vanlove) stay sponsor/
  "worked with" credits on the public marketing page only, not company
  rows.** `supabase/seed.sql` (new — the idiomatic Supabase CLI location
  for non-schema starter data, run automatically by `supabase db reset`
  locally, but needs a manual one-time apply against a remote project —
  see `docs/DEPLOYMENT.md`) seeds both as real `companies` rows with
  their existing `/public/partners/*.png` logo. `primary_color`/
  `accent_color`/`support_contact_*` are deliberately left `null` for both
  — no real values exist yet, and `null` correctly falls back to NTITT's
  own default (now monochrome) via `ThemeProvider`, rather than guessing a
  brand color for either client.
  - The login page and marketing page previously never actually rendered
    `companies.logo_url` at all despite the column existing since Phase
    1 — both now show the resolved company's logo next to the NTITT
    logomark (an "×" lockup, matching the existing "Company × Never Throw
    In The Towel" heading text) when a co-branded subdomain resolves one.
    The marketing page's partner "Trusted by" strip is hidden on a
    co-branded portal itself, since a company's own portal shouldn't also
    show a generic wall of other partners' logos.
- **Week-number framing: yes, surface it in the Company Dashboard.**
  `getWeeklyParticipation` (`src/lib/dashboard/aggregates.ts`) now returns
  a `weekNumber` per row — the week's 1-based position among the
  company's *entire* participation history, not just the displayed slice,
  so "Week 1" always means the company's actual first recorded week even
  when only the most recent 12 are shown. Both the live Dashboard
  (`src/app/(admin)/dashboard/page.tsx`) and the 90-day PDF impact report
  (`ImpactReportDocument.tsx`) now show "Week N" as the primary label,
  with the calendar date kept alongside as supporting detail rather than
  removed outright.

**Real event/podcast photography on the marketing page**: Anthony supplied
9 photos via `Web Image/` at the repo root (same pattern as `NTITT Logos/`
— source material kept in the repo, not deleted after use). 5 were used,
resized/recompressed to web-appropriate sizes into `public/site/`: a hero
shot (a boxing match — the literal "never throw in the towel" image, most
on-message of the set), two event photos ("From our events"), and two
podcast-adjacent photos ("The podcast" — a recording session and a
speaking-engagement shot). Gated behind `{!company}` the same as the
"Trusted by" strip and the co-branded-portal logic above — a client's own
co-branded portal shouldn't show NTITT's own event photography either.
**Deliberately not used**: a casual talking-head video still (redundant
with the stronger podcast-studio photo) and a decades-old, low-resolution
reality-TV broadcast screenshot — personal history unrelated to NTITT
branding and a different category of sensitivity than the rest of the set,
so left out rather than assumed to be fair game for the public site.

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
6. **Company Dashboard** (done) — full aggregate reporting, auto-generated
   90-day impact PDF (server-side generation via `@react-pdf/renderer` — see
   "Company Dashboard (Phase 6)" above for why that one can't reuse Phase 3's
   print-friendly approach).
7. **Community (native)** (done) — shared NTITT-wide feed (`/community`) +
   dedicated Wins Board (`/community/wins`) + optional company space
   (`/community/company`), built on the resolved `scope`-column schema and
   `ntitt_admin` moderation role (`/community/admin`) — see "Community
   scope" above. No Circle bridge. This landed as the final phase, per the
   original sequencing reasoning: the daily core loop, reviews, and content
   library were what made this a sellable, pilot-ready product to HR — the
   parts Circle had no answer for — while Circle provided a live substitute
   for community until this shipped. A shared feed is also more useful, and
   safer to moderate, with an active user base already generating
   check-ins, wins, and reviews to share — which every prior phase now
   provides.

## Open items (business decisions, not blocking Phase 1)

- ~~Exact co-branding depth for flagship clients~~ — **partially resolved
  (Phase 10)**: confirmed logo-level co-branding (own subdomain + logo
  shown alongside NTITT's) for Amazon and KP Snacks specifically — see
  "Co-branding depth (Phase 10)" below. Still open: real brand
  colors for either (their `companies.primary_color`/`accent_color` are
  null, falling back to NTITT's own default), and whether any other
  partner eventually gets the same treatment.
- Whether there's a fixed pilot deadline (e.g. KP Snacks) driving sequencing.
- ~~Real NTITT logo/PWA icon assets~~ — **resolved**: the real logomark
  (`NTITT Logos/NTITT-LOGOMARK-OUTLINE-TRANS.png`, supplied by Anthony) is
  now used throughout — see "Brand assets: real NTITT logo and partner
  logos" below.
- ~~`--brand-accent` placeholder~~ — **resolved (Phase 10)**: confirmed
  monochrome (black/white) is the real brand, not a placeholder waiting on
  a color — see "Co-branding depth (Phase 10)" below.
- ~~Whether the 8 partner/client logos should be seeded as real
  `companies.logo_url` values~~ — **resolved (Phase 10)**: only Amazon and
  KP Snacks, confirmed — the other 6 are sponsor/"worked with" credits
  only, staying on the public marketing-page "Trusted by" strip. See
  `supabase/seed.sql` and "Co-branding depth (Phase 10)" below.
- Circle.so's sunset timeline and whether any of its historical content
  (STAND framework, Talking Tuesdays, Members Events posts/history) is worth
  carrying over — platform builds independently either way; this only
  affects Circle's own wind-down, not the native community schema.
- ~~Per-user timezone~~ — **resolved (Phase 9)**: see "Per-user timezone
  (Phase 9)" below.
- ~~Whether the 30/90-Day Review trigger should be calendar-days-since-start
  rather than active-engagement days~~ — **resolved**: stays
  active-engagement days, confirmed. Calendar-based would risk landing the
  "congratulations" milestone on someone who registered 90 days ago but
  barely engaged, cutting against the review's own "recognise the effort
  you've made" framing. See "No day numbers, per Anthony's guidance" above.
- ~~Whether "Week 1 / Week 4 / Week 12" framing needs to surface in the
  product~~ — **resolved (Phase 10)**: yes, confirmed for the Company
  Dashboard's weekly participation view — see "Week-number framing (Phase
  10)" below.
- ~~Real photo upload for Community posts~~ — **resolved (Phase 9)**: see
  "Community photo upload (Phase 9)" below.
- One-time manual setup needed before Community moderation can be used for
  real: an internal "NTITT (internal)" `companies` row (so an `ntitt_admin`
  profile has something to satisfy the `NOT NULL` `company_id` constraint),
  and Anthony's own profile row's `role` set to `ntitt_admin` — both via
  Supabase Studio, not any in-app flow.
- ~~Whether the platform is invite-only or supports public self-signup~~ —
  **resolved (Phase 11)**: the platform is hybrid B2C + B2B. The general
  public can self-register directly on the NTITT platform via `/signup`
  (`src/lib/actions/signup.ts`); every such account is assigned to one
  shared seeded company, "NTITT Direct"
  (`supabase/migrations/20260807000000_direct_company_seed.sql`,
  `src/lib/tenant/constants.ts`'s `DIRECT_COMPANY_ID`) — chosen over making
  `profiles.company_id` nullable so every existing company-scoped
  RLS policy/aggregate table keeps working unchanged. Partner co-branded
  companies (Amazon, KP Snacks, and any future ones) stay strictly
  invite-only, on purpose — HR still controls who joins their org's space.
  `/signup` and `signUp()` both refuse to run when the request's host
  resolves to a partner company via `resolveCompanyForHost`
  (`src/lib/tenant/resolve.ts`), redirecting to `/login` instead; the
  marketing nav's "Create account" link is hidden the same way. `enable_signup`
  flipped to `true` in `supabase/config.toml` as part of this — the
  existing magic-link sign-in action (`signInWithMagicLink`) was
  simultaneously locked down with `shouldCreateUser: false` so it can never
  itself create a (company-less) account now that signup is globally
  enabled at the Supabase Auth level.
- **Real Supabase project + Vercel deployment**: in progress, driven by the
  account owner per `docs/DEPLOYMENT.md` (this build environment still can't
  do this part itself — see that doc). A Vercel project now exists and is
  connected to this repo — its first deploy attempt surfaced exactly the
  cron-plan-tier risk `docs/DEPLOYMENT.md` flagged in advance (Hobby
  rejected the 15-minute `monitor-support-response-time` schedule); resolved
  by upgrading to Pro, no code change needed. Supabase project status not
  yet confirmed. All migrations under `supabase/migrations/` (7 as of Phase
  9) have been dry-run validated end-to-end against a real local Postgres 16
  every time one was added — schema has RLS enabled on every table across
  `public`/`private`, matching what's documented here.

## Full brief review: two safety-critical gaps found and fixed

A line-by-line audit of the codebase against the original NTITT Full
Platform Build Brief v3.1 and Website Full Spec (the two source documents
this file paraphrases throughout) found the build matches the brief closely
overall, but two real gaps in the one feature the brief calls a failure
condition if it's wrong:

- **The Ask for Support helpline number was never actually configured.**
  `AskForSupport`'s `helplineNumber` prop existed but neither `(app)/layout.tsx`
  nor `(admin)/layout.tsx` ever passed it, so every user saw the literal
  placeholder text "the helpline" with no real number. Fixed by
  `src/lib/support/helpline.ts`'s `resolveHelplineNumber()` — reads an
  optional `HELPLINE_NUMBER` env var, defaulting to Samaritans (116 123,
  free, 24/7), the correct baseline for this platform's UK deployment
  (every seeded/testimonial company is UK-based). This is a national crisis
  line, deliberately separate from `companies.support_contact_*` (the
  company's own designated contact who gets the SMS/email alert) — the
  brief's "if this is urgent right now, please call [helpline]" is a single
  always-available fallback, not a per-company setting.
- **The podcast guest consent process didn't exist.** The brief requires,
  "before recording": a written explanation of what's recorded/shared, an
  anonymity choice (full name / first name only / anonymous), and a
  standing right to withdraw at any time including after publication —
  "this protects the guest and protects the platform legally." The build
  had only a bare `podcast_guest_opt_in` boolean with none of that. Fixed:
  `profiles.podcast_guest_anonymity_preference` and
  `.podcast_guest_consented_at` (migration
  `20260731120000_podcast_guest_consent.sql`) give the consent a durable,
  provable record — re-stamped every time someone opts in, including
  re-opting-in after a withdrawal, since the explanation is re-shown and
  re-agreed to each time. `PodcastOptIn`
  (`src/app/(app)/community/podcast-optin.tsx`) now shows the written
  explanation and collects the anonymity choice before opt-in, and offers
  a one-tap "Withdraw" once opted in. The right to review an episode before
  it airs is stated as a promise here, not faked as an in-app step — there
  is no recording/editing pipeline in this codebase to attach a real review
  gate to; that half of the obligation is a production-process commitment
  Anthony has to keep, not something software can enforce. The admin guest
  list (`community/admin/podcast-guests`) now shows each guest's actual
  credit choice and consent date, so producing an episode has something
  concrete to honour.

Also found in the same review, not yet fixed (see conversation history /
task tracker for the full punch list): Ask for Support doesn't render on
`/onboarding` or `/login`; the HR dashboard doesn't show the 90-day review
completion count on-screen (only 30-day) and its weekly participation view
only covers the current week; the user's own 90-day summary "PDF export" is
actually the browser print dialog; nutrition education content, buddy
pairing, and the full monthly-podcast episode structure (from the Website
Spec's Section 6) don't exist at all.

## Full platform re-review (2026-08)

A second full-platform review (security, correctness, brief-compliance, and
accessibility) against the same two source briefs. The full findings and the
prioritised remaining work are in `docs/ROADMAP.md`; the fixes landed in this
pass are recorded here. It also corrected two stale claims from the section
just above: Ask for Support **does** render on `/onboarding` (via
`OnboardingFlow`), and the HR weekly-participation view **is** multi-week
(Phase 10), not current-week-only.

**Security**
- **CRITICAL: privilege escalation via `handle_new_user`.** With
  `enable_signup = true` (Phase 11), the trigger's reading of `role` and
  `company_id` from client-controlled `raw_user_meta_data` let anyone call
  GoTrue's `/signup` with the public anon key and self-provision an
  `ntitt_admin` (or arbitrary-company `hr_admin`) profile — a full compromise
  of the admin/community/tenant plane. The private-journal RLS boundary held
  regardless (no private-table policy references any admin role). Fixed in
  `20260810000000_harden_handle_new_user_role.sql`: the trigger now always
  provisions `role='employee'`, `company_id=DIRECT_COMPANY_ID` and reads
  neither from metadata. Not a regression — both the invite flows and direct
  signup already upsert the real role/company via the service-role client
  immediately after (`onConflict:"id"`), which overrides the safe default.
- **Comment scope binding** (`20260810010000_bind_comment_scope.sql`): the
  `community_comments` INSERT policy now requires `scope`/`company_id` to
  match the parent post (and, for company scope, the author's own company),
  closing a cross-tenant comment-injection path the `community_posts` policy
  already guarded against.
- **`companies` support-contact PII**
  (`20260810020000_restrict_company_contact_columns.sql`): `support_contact_*`
  and `ninety_day_report_sent_at` were world-readable via the anon key (the
  `using (true)` SELECT policy is row-level, not column-level). Now a
  column-level SELECT grant exposes only branding/identity columns to
  anon/authenticated; `resolveCompanyForHost` selects explicit columns
  instead of `*`, and `submitSupportRequest` reads contacts via the admin
  client (the correct client for staff routing info anyway).
- **`escapeFilterValue`** now escapes backslashes before quotes (a trailing
  `\` could otherwise escape the closing quote of a PostgREST filter value).
- **Cron auth** (`src/lib/auth/cron.ts`, `verifyCronRequest`): the four
  `/api/jobs/*` routes now fail **closed** when `CRON_SECRET` is unset (the
  old inline check accepted `Bearer undefined`) and compare in constant time.

**Correctness**
- HR "staff enrolled" headcount was `sum(eligible_count)` over the week
  (~7× inflation); now the max single-day snapshot (`headcount` on
  `WeeklyParticipation`), with tests. Percentages were and remain correct.
- `getPendingPeriodicReview` returns the earliest incomplete milestone, so a
  user who hits 90 active days without doing the 30-day review gets 30 first,
  then 90 — not out of order.
- Community report idempotency (`20260810030000_community_report_dedup.sql` +
  `reportCommunityPost` treats `23505` as success): one report per
  (post, reporter), so repeat taps don't flood the moderation queue.
- `getPosts` filters `is_removed` so moderated posts don't reappear in the
  feed for `ntitt_admin` (the base RLS already hid them from everyone else).
- Talking Tuesday's monthly podcast uses `isFirstWeekdayOfMonthInWeek`
  (this week's Tuesday), so it still surfaces on this-week catch-up rather
  than only when opened on the literal Tuesday, with tests.

**Safety & accessibility**
- **Pre-auth crisis support** (`src/components/PreAuthSupport.tsx`): the
  full "check in with me" flow is session-gated (it routes to the user's own
  company contact), so `/login`, `/signup`, and the marketing site — which
  showed nothing before — now surface the always-available national crisis
  line as a one-tap `tel:` link (`resolveHelplineTel`). Honest minimum for a
  screen where no personal callback can be promised.
- **Ask-for-Support modal** is now a full ARIA dialog (`role="dialog"`,
  `aria-modal`, focus trap, Escape, focus restore, backdrop dismiss, scroll
  lock, `role="status"` success) — the product's one non-negotiable safety
  feature was previously a bare div a keyboard/SR user could tab out of
  unknowingly.
- The inline support trigger is pinned with the bottom nav
  (`(app)/layout.tsx`) so it's genuinely always visible.
- **Accent contrast**: `--brand-accent` darkened `#ec3013` → `#c81e0f` to
  meet WCAG AA (~5.19:1, was ~3.76:1) on every CTA, the active nav tab, the
  content chips, and the support trigger. This also supersedes the "Brand
  color: monochrome" claim in "Co-branding depth (Phase 10)" above — the
  live theme is light-default with a red accent (`globals.css` is the source
  of truth), not black/white. The exact red is a deliberate,
  AA-constrained accessibility value and can be tuned with Anthony as long as
  it stays ≥4.5:1.
- Labels added to the content search (`type="search"`, `role="search"`) and
  the community composer; the community feed now has a real `<h1>`.

The broader accessibility backlog (colour-only status indicators, the
opacity-as-text-colour sweep, routine-form success announcements, tap-target
sizing, loading/not-found states, the marketing logo chips, and the offline
PWA gap) is catalogued and prioritised in `docs/ROADMAP.md` rather than done
in this pass.
