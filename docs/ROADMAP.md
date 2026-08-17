# NTITT Platform — Review Findings & Dev Roadmap

Date of review: 2026-08-10. This is a full-platform review against the two
original source briefs (Full Platform Build Brief v3.1, Website Full Spec)
plus a security, correctness, and accessibility audit of the built code. It
records what was found, what was fixed in the same pass, and the prioritised
work still to do.

The platform is a mature 11-phase build and is broadly faithful to the
briefs — the daily core loop, reviews, community, content library, HR
dashboard, Ask-for-Support, and PWA plumbing all exist and work. The
privacy foundation (all personal data private to the user; HR sees
aggregate-only; sleep score and day rating never reportable) is genuinely
enforced by Postgres RLS and was verified as solid. The findings below are
the gap between "built" and "hardened, accessible, and fully spec-complete."

**This roadmap now has two horizons**, and they run in parallel:

- **The strategic direction — the content platform** (next section): the
  forward chapter, turning NTITT into a content operating system. This is
  new build, and it is the primary thrust. The full reasoning, verified
  current state, and schema proposals are in
  `docs/CONTENT_PLATFORM_STRATEGY.md`; the phased plan is summarised below.
- **The hardening & accessibility backlog** (Priority 1–3 and the
  accessibility section further down): the near-term correctness, safety,
  and WCAG follow-ups from the review. These do not block the strategic
  build and can be picked up alongside it.

---

## Next up — the short launch-polish list (parked 2026-08-15)

Four items surfaced by the launch-readiness sweep that are worth clearing
before/around go-live. All are already documented in detail elsewhere; this
is the consolidated "pick these up next" shortlist so they don't get lost:

1. **Manifest colours + maskable icon.** `src/app/manifest.ts` ships
   `background_color`/`theme_color` as dark `#0a0a0a` while the app is a light
   theme, and there is no maskable-purpose icon (Android home-screen icons get
   letterboxed). Small. _Detail: Priority 2 · item 6 below._
2. **Offline-capable PWA.** `public/sw.js` registers only when push is enabled
   and has no `fetch` handler / precache / offline submit queue, so the
   "installable, offline-capable" manifest claim overstates reality. Either
   implement app-shell caching + an offline form queue and register on load, or
   narrow the claim. Medium–large. _Detail: Priority 2 · item 6 below._
3. **Real 90-day PDF export.** The member's 90-day review "PDF export" is still
   the browser print dialog; wire it to the existing server-side
   `@react-pdf/renderer` pipeline (already powering the HR impact report) for a
   real, shareable file. Small–medium. _Detail: Priority 2 · item 4 below._
4. **Error tracking + push-failure alerting.** No Sentry/equivalent, and no
   central alert when a cron job (esp. the push dispatcher) fails — the
   `/api/health` probe and `[cron:*]` logs make failures visible only on a
   pull. Needs an ops address. _Detail: `docs/LAUNCH_READINESS.md` "Still open."_

---

## Strategic direction — the content platform (the next chapter)

Full detail: `docs/CONTENT_PLATFORM_STRATEGY.md`. The shift is from
"features built" to a **content operating system**: Anthony creates, and
the platform distributes his content intelligently — on the right day, down
the right channel, to the right member — and keeps them coming back. Five
pillars: content as a first-class atom (video **and** document/image); the
Mon–Sun framework as the organising grid; challenges as the container;
channels for per-partner targeting; and an AI brain that assists the Super
Admin with tagging and distribution. Underneath, an engagement flywheel —
a deeper community and a persisted gamification layer — keeps consumption
sticky.

**The architectural spine** is one change everything else hangs on:
generalise `content_videos` into a `content_items` model whose tag
dimensions (`type`, `day_of_week`, `theme`, channel placements, challenge
membership) are the substrate the carousels, challenges, targeting, and AI
all read from. It is the critical path and the one migration that touches
existing surfaces, so it goes through
`supabase/tests/validate_migrations.sh` like every schema change.

**Phased plan** (dependencies and parallel tracks — see the strategy doc):

_Track 1 — the content spine (critical path)_
- **A1. Content spine** — `content_items` + channel placements + a
  `content-assets` Storage bucket; backfill `content_videos`; harness-
  validated. *Gate to everything else._
- **A2. Super Admin Studio (thin)** — `ntitt_admin`-gated: add an item, tag
  it day/theme/channel, publish. The keystone that lets Anthony self-serve.
- **A3. Day carousel** — one live day-tagged, channel-scoped, ISO-week-
  rotated carousel surface.
- **B. Challenges** — _built this pass._ `challenges` / `challenge_days`
  (public, ntitt_admin-authored) sequence the spine; `challenge_enrollments` /
  `challenge_day_completions` (private, own-rows-only RLS) hold a member's
  participation. Members browse/join/track at `/challenges`; the Studio authors
  at `/community/admin/challenges`. Progress is completion-count only — no
  "expected day", so nothing ever reads as behind (the "no day numbers"
  principle, enforced by the schema). Harness-validated.
- **C. AI brain v1 (assistive)** — _shipped this pass._ In the Studio: an
  **AI "Suggest theme, day & tags"** button (structured-output call to Claude
  via `@anthropic-ai/sdk`) that pre-fills the composer for the admin to confirm
  or edit — assistive-with-confirm, it never writes or publishes and only ever
  reads content metadata (never a member's private journals). Plus a
  **deterministic coverage/gap panel** (counting lives in code, not an LLM):
  which Mon–Sun days and which themes have no published content. Reads
  `ANTHROPIC_API_KEY` from the env (set in Vercel) and the model is env-
  overridable (`ANTHROPIC_MODEL`, defaults to the current Opus); degrades to a
  friendly "not configured here" when the key is absent, and the gap panel needs
  no key at all. Not exercised against the live API from here.
- **E. AI brain v2** — personalised ranking, once engagement data exists.

_Track 2 — the engagement flywheel (independent, parallelisable)_
- **D1. Community depth** — _threaded comments + new/top/hot feed sorting
  shipped._ Two-level replies over the existing flat comments (additive
  `parent_comment_id`, server-side re-derivation + flatten, harness-validated
  live RLS proving a reply inherits its parent post's scope). Feed sorting —
  **New** (default), **Top** (most-liked), **Hot** (recency-weighted popularity)
  — as plain shareable-URL tabs, ranked in-app over a recent candidate window
  (no schema change; no untested DB aggregate ordering). The vote question is
  resolved **up-only** — the existing community *likes* serve as upvotes, so no
  downvote is added (a peer mental-health space: easy to add later, hard to walk
  back the harm). _Open for Anthony:_ up/down-vs-up-only, and — if a board ever
  outgrows ~200 recent posts — server-side ranking / paging.
- **D2. Gamification** — _shipped in full: steps end-to-end, badges (with conscious sharing), and the company step challenge._
  Anthony's **Step Count & Gamification brief** (2026-08-13) now drives this
  chapter and resolves two of the open decisions below: **no individual
  leaderboard** (a deliberate call — a **collective team target** instead, so
  no one is a "loser"), and **rewards are company-funded / HR-set** (NTITT only
  displays them and confirms the target is hit).
  - _Part 1:_ self-reported **steps** — a private, never-reportable
    `step_entries` metric (own-rows-only RLS, modelled on `sleep_score` /
    `day_rating`; harness-validated live). Log today, see your own 7-day trend.
  - _Part 2:_ **persisted badges** — badges were derived every load; now the
    first time one is earned it's recorded in `private.earned_badges`
    (own-rows-only, insert-and-read only, **revoke-proof** — no update/delete
    policy), capturing `earned_at`. Awarded on the Today load (re-derived
    server-side, idempotent) with a one-time "new badge" note; surfaced with
    dates on the Journey. Harness-validated live RLS.
  - _Part 3 (foundation, PR #68):_ steps wired **end-to-end** to the brief §1/§3
    surfaces — the optional **"Steps today"** field on the Night Routine
    (best-effort, never mandatory, prefilled); **average daily steps in the
    30/90-day reviews** (the 90-day adds a first-30-vs-quarter comparison);
    and three **step-milestone badges** (10K Club, Week Streak, 30 Day Mover),
    evaluated from monotonic best-ever figures so they can be earned but never
    lost. All own-rows-only, no schema change, no aggregate path.
  - _Part 4 — the **company step challenge** (brief §2/§4), shipped end-to-end
    (PRs #69–#73):_ `public.company_step_challenges` (HR-authored, **invited
    clients only** via a CHECK barring the shared self-signup pool) + a private
    opt-in table (default opted-in; opting out invisible) → a single service-role
    **aggregate** (`company_step_totals`, daily cron) with a **≥5-contributor
    floor** below which the team total is suppressed and stored as 0, so a small
    team's aggregate can never reveal one person. On top: HR **setup + a
    read-only dashboard tile** (team total, opt-in rate, target hit); the **staff
    screen** (progress bar, contributors, days left, reward, **private** opt-in
    toggle); a **target-hit email** to HR (aggregate only, once, on transition);
    the **reward** itself is company-chosen, funded and hosted (the platform runs
    the challenge and signals the target hit, but never handles prizes or
    payment); and, at challenge end,
    **Challenge Complete** to every contributor when the target is hit plus a
    **private Team MVP** award to the single top contributor (own-rows-only, so
    no ranking is ever exposed). Individual step counts and opt-in identities are
    **never** exposed — proven with live RLS tests in the migration harness.
  - _Part 5 — **conscious badge sharing** (brief §3):_ badges stay private on the
    member's Journey; a **Share** control lets them CHOOSE to surface one onto the
    community **wins board** (a normal `community_posts` row carrying the
    `shared_badge_key`, deduped, and only after verifying they actually earned it
    under the own-rows-only private client). Nothing is shared automatically; only
    the badge label + display name go public. This completes the brief's
    "visible to others only if the user shares" line.
  - _Carve-out:_ Apple Health (HealthKit) / Google Fit **auto-sync is native-
    app only** (a browser can't read those SDKs). The web ships manual entry;
    a future native shell POSTs into the same `step_entries` table.
  - _Deferred:_ a points **ledger** — points are derived from monotonic counts
    today and don't yet need their own store.

**Privacy invariants that must survive this chapter** (from the strategy
doc): steps / any health metric are `private` and **never-reportable**,
exactly like sleep score and day rating; leaderboards, if built, are
opt-in and scope-safe; the AI brain reads content and aggregates, never
private journals; aggregation stays one-way (`private → public`),
service-role only.

**Recommended first slice: A1 + a thin A2 + A3** — the spine, a minimal
Studio, and one live day carousel. Everything else plugs into it.

**Open decisions for Anthony** (do not block A1; they shape the surfaces on
top): challenge day counters vs "no day numbers"; up/down vs up-only votes;
where the carousel lives; AI autonomy (assistive-only for v1); documents
inline vs download. Full list in the strategy doc. _Resolved by the Step
Count & Gamification brief:_ **leaderboards** (no — collective team target)
and **steps self-reported vs integrated** (self-reported/manual on web now;
HealthKit/Fit auto-sync is a native-app follow-up).

**Status**: strategy + roadmap written; the first slice (A1 → thin A2 → A3)
shipped; **B. Challenges** shipped; and the content-OS is now **surfaced in the
daily loop** — the day-tagged, week-rotated carousel and the member's own
challenge progress both appear on Home, not only in the Library, so the spine
and challenges are discoverable where members already are each day (pure reads;
no schema change). **C. AI brain v1 (assistive)** is now shipped too — Studio
AI tag-suggestions (assistive-with-confirm, structured output via
`@anthropic-ai/sdk`, `ANTHROPIC_API_KEY` set in Vercel and the model
env-overridable) plus a no-key deterministic coverage/gap panel; not exercised
against the live API from here. In parallel, **Track 2 · D1 (community depth)**
is essentially done — threaded comment replies and new/top/hot feed sorting both
shipped (up-only votes, reusing the existing likes); only the up/down decision
is left to Anthony. That clears Track 1's critical path through v1; the next
frontier is **E. AI brain v2** (personalised ranking) once engagement data
accrues, plus the Track-2 **D2 gamification** work under the privacy invariants.

---

## Platform hardening & accessibility backlog (runs alongside)

The review-driven correctness, safety, and WCAG follow-ups below are the
second horizon — near-term, independent of the strategic build.

---

## Fixed in this pass (see the PR / `docs/ARCHITECTURE.md` "Full platform
## re-review")

**Security**
- 🔴 **CRITICAL — privilege escalation via self-signup.** The
  `handle_new_user` trigger trusted client-supplied `role`/`company_id` from
  signup metadata under `enable_signup = true`, letting anyone self-mint an
  `ntitt_admin` by calling GoTrue directly with the public anon key. Trigger
  hardened to always provision a plain `employee` in the direct company;
  privileged roles come only from the service-role invite/signup upserts.
- Community **comment** INSERT policy now binds `scope`/`company_id` to the
  parent post (was cross-tenant injectable).
- `companies` support-contact PII is no longer world-readable via the anon
  key (column-level SELECT grant; the app reads contacts via the service
  role).
- `escapeFilterValue` now escapes backslashes (could otherwise break out of
  a quoted PostgREST filter).
- Cron routes fail **closed** on a missing `CRON_SECRET` and use a
  constant-time comparison (shared `verifyCronRequest`).

**Correctness**
- HR dashboard "staff enrolled" headcount was inflated ~7× (summed
  `eligible_count` across the week); now a single-day snapshot, with tests.
- 30-day review can no longer be forced *after* the 90-day one (earliest
  incomplete milestone first).
- "Report post" is now idempotent (unique constraint + graceful handling) —
  no more duplicate moderation-queue rows.
- Moderated-away posts no longer reappear in the feed for `ntitt_admin`.
- Talking Tuesday's monthly podcast now shows on this-week catch-up, not
  only when opened on the actual Tuesday (with tests).

**Safety & accessibility**
- **Ask for Support now appears on `/login`, `/signup`, and the marketing
  site** (crisis helpline as a one-tap `tel:` link) — it previously showed
  nothing pre-auth, on exactly the screens a distressed visitor might sit on.
- The **Ask-for-Support modal** is now a proper accessible dialog
  (`role="dialog"`, focus trap, Escape, focus restore, backdrop dismiss,
  scroll lock, announced success).
- The inline support trigger is **pinned to the bottom** so it's genuinely
  always visible (was scrolling off long pages).
- Accent red darkened `#ec3013` → `#c81e0f` to meet WCAG AA contrast (was
  ~3.76:1 on all CTAs, nav, and the support trigger).
- Labels added to the content search and community composer; community feed
  now has a real page heading.

---

## Priority 1 — Safety & correctness follow-ups (near-term)

1. **Timezone-correct participation aggregation** — _done this pass._ The
   daily cron ran at 02:00 UTC and processed only "yesterday-UTC", but
   `entry_date` is written in each user's own timezone (Phase 9), so users
   west of ~UTC-2 (all of the Americas — Amazon, plus NTITT Direct public
   signups) had their evening/night completions systematically undercounted:
   their local day hadn't finished when the job ran, and that date was never
   revisited. Fixed by re-aggregating a **trailing window of recent UTC days**
   (`AGGREGATION_WINDOW_DAYS = 3`) on every run rather than a single day. The
   participation upsert is idempotent per `(company, entry_date, segment)` and
   recomputes each count from source, so once a date has fully settled in
   every timezone (guaranteed within ~26h of UTC midnight) a later run
   overwrites the earlier partial count with the correct one — no fragile
   "westmost zone in use" assumption baked in, and `?date=` still forces a
   single explicit date for manual backfill. New `recentUtcDates` helper in
   `src/lib/routines/dates.ts`, with tests.
2. **Dry-run validate the new migrations** against a real local Postgres 16
   (the project's standard step, per `docs/DEPLOYMENT.md`) — _done this pass._
   All 18 migrations (including the four `20260810000000`–`20260810030000`
   hardening/correctness ones) now apply cleanly in order against a real local
   Postgres 16, and RLS is enabled on all 23 tables. The GRANT/RLS behaviour
   the review flagged is asserted directly — the `companies` contact-PII
   column grants, and a **live** RLS check of the comment-scope binding run as
   the `authenticated` role with a simulated JWT (cross-label injection
   blocked, legitimate comment allowed) — plus the `handle_new_user`
   role-trust fix and the report dedup constraint. Made reproducible as
   `supabase/tests/validate_migrations.sh` (stub + assertions), so future
   schema changes get the same guard. _Effort: S._

## Priority 2 — Sellability & core-loop completeness

3. **HR dashboard 90-day completion count** — _done this pass_ (was computed
   but not rendered). Listed here for provenance.
4. **User's own 90-day review — real PDF export.** Today the "PDF export" is
   the browser print dialog. Reuse the existing server-side
   `@react-pdf/renderer` pipeline (already used for the HR impact report) so
   the user gets a real, shareable file. _Effort: S–M._
5. **Nutrition education content** — _enum + Library tab done this pass._
   Spec'd (Website Spec §8) but previously absent: no `nutrition` value in the
   `video_category` enum and no nav. The enum value now exists
   (`20260812000000_add_nutrition_video_category.sql`, dry-run validated by the
   migration harness) and the Content Library has a Nutrition tab (`CATEGORIES`
   in `src/app/(app)/content/page.tsx`, `VideoCategory` in
   `src/types/database.ts`). The content itself — seeding nutrition videos into
   `content_videos` — stays a content-ops task via Supabase Studio, the same as
   every other category. _Effort: S–M._
6. **Offline-friendly daily forms (PWA).** `manifest.ts`/the brief promise an
   installable, offline-capable app, but `public/sw.js` has no `fetch`
   handler, no precache, and no offline form queue, and the SW only registers
   when a user enables push. Either implement app-shell caching + an offline
   submit queue and register the SW on load, or correct the claim. Also align
   the manifest `theme_color`/`background_color` (currently dark `#0a0a0a`)
   with the actual light theme, and add a maskable icon. _Effort: M–L._

## Priority 3 — Differentiators (later)

7. **Monthly podcast full structure.** Only a single "latest episode" link
   exists on Talking Tuesday. The Website Spec §6 calls for a
   week-of-month cadence (episode drop week 1; shorter prompts weeks 2–3;
   peer-led week 4) and the consent process (the consent record exists;
   the episode structure doesn't). _Effort: M._
8. **Post-talk feedback / KP Snacks proof-of-impact form.** A named
   requirement (Website Spec §11) — the QR-code post-talk survey whose
   aggregate results become the next pitch's proof data. Currently absent.
   _Effort: M._
9. **Buddy pairing.** Optional colleague check-in pairing (Website Spec §9).
   Largest greenfield item: new schema, matching, and UI. _Effort: M–L._

## Accessibility backlog (WCAG, grouped)

This is a mental-health product, so inclusive access matters especially.
Beyond the safety-critical items already fixed:
- **Status conveyed by colour alone** — the home weekly tracker and the
  Journey ratings chart (sleep vs day-rating bars) need text/`aria`
  equivalents; the private wellbeing trend is currently invisible to
  screen-reader users. _Effort: S–M._
- **Opacity-as-text-colour** — `opacity-40/50/60` on hint/caption/label text
  measures below AA on the light ground. Define a proper muted token
  (≥4.5:1) and stop using opacity for text colour. _Effort: S (sweep)._
- **Routine-form success announcement** — every routine form replaces itself
  with a success `<div>`, dropping focus to `<body>` with no announcement.
  Add `role="status"` + focus move (the pattern the support modal now uses).
  _Effort: S._
- **Tap targets** — bottom nav, the 1–10 tap scales, workout tier pills, and
  the push toggle are below the comfortable 44px. _Effort: S._
- **Loading & not-found states** — no `loading.tsx`/Suspense anywhere
  (navigation feels dead on mobile networks) and no custom `not-found.tsx`.
  _Effort: S–M._
- **Form details** — `required` on `sr-only` radios (validation bubble
  anchors off-screen); `PeriodicReviewForm` computes `new Date()` in render
  (hydration risk + ignores the user's timezone); auth inputs lack
  `autoComplete`; onboarding Sunday time is `required` but labelled
  "Optional". _Effort: S._
- **Push toggle** should be a real `role="switch"` (label states status, not
  action). _Effort: S._

## Marketing site

- Partner logos render without the white chip the mix of transparent/opaque
  logos needs, so light logos can vanish; and under `prefers-reduced-motion`
  the marquee stops but stays `overflow-hidden`, permanently clipping most
  logos — switch to a wrapped/scrollable static layout there. _Effort: S._

## Documentation drift to reconcile (called out by the review)

- The **theme** is light-default with a red accent (`globals.css`), but
  `docs/ARCHITECTURE.md` (Phase 10) still describes a monochrome
  black/white brand. The code is the source of truth; the doc's "Co-branding
  depth (Phase 10)" section should be updated.
- The **offline PWA** claim (above) overstates what `public/sw.js` does.
- A few **Ask-for-Support gap notes** in the architecture doc's final
  section are now stale (it IS on `/onboarding`; HR weekly participation IS
  multi-week) — corrected in the re-review section.
