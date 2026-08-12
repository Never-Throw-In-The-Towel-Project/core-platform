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
- **C. AI brain v1 (assistive)** — tag suggestions + gap detection in the
  Studio (assistive-with-confirm, never auto-publish).
- **E. AI brain v2** — personalised ranking, once engagement data exists.

_Track 2 — the engagement flywheel (independent, parallelisable)_
- **D1. Community depth** — up/down (or up-only) votes, threaded comments,
  hot/top/new sorting. No dependency on the content spine.
- **D2. Gamification** — persist points/badges, add steps (self-reported
  first), rewards, and opt-in leaderboards — under the privacy invariants
  below.

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
whether leaderboards are in scope; steps self-reported vs integrated;
where the carousel lives; AI autonomy (assistive-only for v1); documents
inline vs download. Full list in the strategy doc.

**Status**: strategy + roadmap written; the first slice (A1 → thin A2 → A3)
shipped; **B. Challenges** shipped; and the content-OS is now **surfaced in the
daily loop** — the day-tagged, week-rotated carousel and the member's own
challenge progress both appear on Home, not only in the Library, so the spine
and challenges are discoverable where members already are each day (pure reads;
no schema change). Next on the critical path: **C. AI brain v1 (assistive)** —
Studio tag-suggestions + gap detection. C is the first item needing an external
dependency (`ANTHROPIC_API_KEY` + a small per-call budget) and is
assistive-with-confirm — never auto-publish — so it wants Anthony's budget
go-ahead before wiring.

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
