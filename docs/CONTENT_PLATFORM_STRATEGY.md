# NTITT Platform — Content Platform Strategy (the next chapter)

Date: 2026-08-12. This is a durable strategy record, written in the same
spirit as `docs/ARCHITECTURE.md`: decisions and direction live in the
codebase, reasoned and grounded in what is actually built, not left in chat
history. `ARCHITECTURE.md` records how the platform got to where it is;
this document records where it goes next, and why.

It is deliberately explicit about the boundary between **verified current
state** (checked against the real code, with file references) and
**proposed direction** (subject to Anthony's sign-off). Nothing here is
built yet. The "Open decisions" section at the end is the shortlist of
questions whose answers change the shape of the work.

---

## The reframe

The core product is mature and broadly spec-complete. Across 11 phases
(`ARCHITECTURE.md` "Roadmap") the platform already delivers the daily core
loop, the 30/90-day reviews, a native community, the content library, the
HR aggregate dashboard, Ask-for-Support with escalation, the co-branded
portal system, PWA plumbing (installable + push), and a genuinely enforced
privacy boundary. The remaining review-backlog work (`docs/ROADMAP.md`) is
hardening and accessibility, not missing pillars.

So the next chapter is not "more features." It is turning NTITT into a
**content operating system**: Anthony creates, and the platform
distributes his content intelligently, on the right day, down the right
channel, to the right member — and keeps them coming back to consume it.

Five pillars carry that shift:

1. **Content is the atom.** Videos, documents, and images are all
   first-class content, all richly tagged — not just Vimeo videos.
2. **The Mon–Sun framework is the organising grid.** Content is tagged by
   day and rotates: a bank of "Monday Motivations", a different one served
   each Monday.
3. **Challenges are the container.** 28-day, 90-day, and ad-hoc programmes
   sequence that tagged content over time.
4. **Channels decide who sees what.** NTITT-wide vs KP Snacks vs Amazon —
   content is targeted and prioritised per partner.
5. **An AI brain assists the Super Admin** — it understands each piece of
   content (day / theme / channel) so tagging and distribution can be
   proposed automatically, with Anthony always confirming.

All of it pulls against one flywheel: a deeper, Reddit-style **community**
and a persisted **gamification** layer (points, badges, steps, rewards)
that make consumption sticky.

---

## Where we are today (verified against the code, not assumed)

Every claim below was checked against the actual source on
`claude/platform-review-roadmap-z1ko2k`, not inferred from the briefs.

- **Content is video-only.** `public.content_videos`
  (`supabase/migrations/20260730000000_init_schema.sql`, typed in
  `src/types/database.ts`) is `{ vimeo_id, title, category, tags[],
  workout_tier?, duration_seconds? }`. `category` is the `video_category`
  enum (`mental_fitness | physical_fitness | nutrition | tools_tips`).
  There is no document or image content type, no stored thumbnail (the
  Library renders a "Still" placeholder — `src/app/(app)/content/page.tsx`),
  and **no day-of-week, channel, or challenge dimension** anywhere on the
  row.
- **Content ops is Supabase Studio, by explicit decision.** Phase 4
  (`ARCHITECTURE.md` "Content Library") deliberately did *not* build an
  in-app CMS: "building a redundant internal tool for what's effectively
  spreadsheet-equivalent data entry isn't work this phase needs to do.
  Revisit only if Anthony finds the raw table editor genuinely unworkable
  in practice." The content-OS vision **is** that revisit — the Studio is
  now the point, not redundant, because the platform (not a spreadsheet)
  is what will do the distributing.
- **Gamification already exists — but it is entirely derived and
  ephemeral.** `src/lib/gamification/` computes streak, wins, rank
  (Contender → Challenger → Cornerman, only "Contender" confirmed), badges
  (six, e.g. First Week / 30 Days), and the review-progress ring on the fly
  in `getTodayStats` from `morning_entries` / `night_entries` /
  `themed_checkins` / `community_posts`. **There are no points, badge,
  steps, or leaderboard tables** — nothing is persisted, nothing is
  awarded, nothing is reported. The code is careful and honestly
  non-punitive (`badges.ts`, `rank.ts` both carry "OPEN PRODUCT DECISION"
  headers awaiting Anthony's sign-off).
- **Community is likes + flat comments, not votes + threads.**
  `community_posts` / `community_comments` / `community_likes` /
  `community_reports` (`src/types/database.ts`). A like is a row, not an
  up/down score; comments have no `parent_comment_id`, so no threading; and
  the feed has no hot/top/new ranking. `scope` (`global | company`) and
  `board` (`feed | wins`) are the only axes.
- **Channels already have a foundation.** Co-branded portals are
  `public.companies` rows with skin overrides (`logo_url`,
  `primary_color`, …) resolved by host (`src/lib/tenant/resolve.ts`);
  Amazon and KP Snacks are seeded (`supabase/seed.sql`), plus the
  "NTITT Direct" and internal rows. This is exactly the substrate a
  "channel" needs — but content is not yet targeted to companies at all
  (every video is readable by every authenticated user, full stop).
- **The Mon–Sun grid exists for check-ins, not content.** The five weekday
  themed check-ins (`weekday_theme` enum, Mon–Fri only), Sunday Setup, and
  Weekly Review are first-class (`ARCHITECTURE.md` "Daily core loop"), and
  the Today rail already frames the week. But content is not tagged to a
  day, and the enum stops at Friday.
- **The 30/90-day *reviews* exist; *challenges* do not.** The periodic
  reviews are personal milestones keyed off active-engagement days
  (`src/lib/routines/periodicReview.ts`). There is no concept of a themed,
  multi-day content *programme* a member opts into.
- **No AI anywhere.** No `@anthropic-ai/sdk`, no Claude/LLM calls in the
  codebase (grepped). The AI brain is fully greenfield.
- **The safety rails we must not break** are real and enforced by Postgres
  RLS, not app discipline (`ARCHITECTURE.md` "Privacy boundary"): all
  personal check-in/routine/review data is private to the user; HR sees
  aggregate-only; **sleep score and day rating are never reportable even in
  aggregate.** Aggregation is one-way `private → public`, service-role
  only. Any new health metric (steps) or social surface (leaderboards)
  lands on the right side of this line or it does not land.

Two pleasant surprises fell out of the audit: the gamification scaffold
already exists (we deepen it, we don't start it), and the co-branded portal
system is already the channel foundation (we target onto it, we don't
invent tenancy).

---

## The architectural spine: `content_items`

Everything in this document hangs on one change: generalise
`content_videos` into a **`content_items`** model whose tag dimensions
*are* the substrate the AI brain, the carousels, the challenges, and the
channel targeting all read from. Get this shape right and a "20 Monday
Motivations" carousel is a query; get it wrong and every downstream pillar
inherits the mistake. It is the critical path, and it is the one migration
that touches existing surfaces (the Library, the Workout Wednesday demo
links), so it goes through the validation harness
(`supabase/tests/validate_migrations.sh`) like every schema change before
it.

**Proposed shape** (details are for design review, but the dimensions are
the point):

- `public.content_items`
  - `id`, `title`, `created_at`, plus authored metadata (`summary`,
    `created_by`).
  - `type` — a **new** `content_type` enum (`video | document | image`,
    room for `audio | link` later). A freshly-created enum used in the same
    migration is fine; the Postgres "can't use a new enum value in the
    transaction that added it" rule only bites `ALTER TYPE … ADD VALUE`
    (see `ARCHITECTURE.md` on `20260731020000_add_ntitt_admin_role.sql`) —
    so this is one migration, but adding a *value* to it later is its own.
  - `media` — one of: `vimeo_id` (video), a Storage path (document/image),
    or an external `url`. Documents/images reuse the Storage pattern proven
    in Phase 9 (`community-images` bucket + folder-prefixed RLS,
    `src/lib/community/imageUpload.ts`) — a new `content-assets` bucket, not
    a new mechanism.
  - `theme` — generalises today's `video_category` (kept working via
    backfill) into the content taxonomy (motivation, workout, nutrition,
    mindfulness, tools…).
  - `day_of_week` — **nullable** (much content is day-agnostic). Recommend
    an ISO smallint (1 = Mon … 7 = Sun) rather than extending the Mon–Fri
    `weekday_theme` enum, because the grid is explicitly Mon–**Sun** and a
    nullable integer sidesteps the enum-add friction entirely.
  - `tags text[]` — free tags, carried over from `content_videos` so
    today's title/tag search keeps working.
  - Optional `workout_tier`, `duration_seconds` — carried over.
- `public.content_channel_placements` — the targeting join:
  `(content_item_id, company_id nullable, priority)`. **Zero rows for an
  item = NTITT-wide** (visible to every channel, today's behaviour); a row
  per company restricts/targets it; `priority` drives per-partner ordering.
  This keeps "built once, runs everywhere" as the default and makes
  targeting purely additive — the same core-vs-portal principle
  `ARCHITECTURE.md` is built around.
- **Backfill**: every existing `content_videos` row becomes a
  `content_items` row of `type = 'video'` with its `category` mapped to
  `theme`, tags preserved, no channel rows (i.e. stays global). The Library
  reads `content_items` after the cutover; `content_videos` is retired (or
  kept as a compatibility view for one release) rather than dual-written.

**RLS**: read follows `content_videos`' existing "authenticated users read
content" policy, *plus* the placement filter (global items, or items placed
on the viewer's own `profiles.company_id`). Writes are **`ntitt_admin`
only** — a new, tightly-scoped policy, since this is the first content a
role other than the service role will write from the app. (Contrast the
current model, where all content arrives via Studio/service-role.)

---

## Pillar 1 — Content generalisation (video · document · image)

- **Today**: Vimeo videos only.
- **Gap**: PDFs/worksheets (documents) and images (infographics, quote
  cards) can't exist as content.
- **Direction**: the `type` + `media` split above. Video stays Vimeo (the
  deliberate no-ads/no-autoplay/consent-friendly choice —
  `ARCHITECTURE.md` "Stack"). Documents/images go to a `content-assets`
  Storage bucket via the Phase 9 server-side upload pattern.
- **Open**: do documents render inline (PDF viewer) or download? Are images
  ever the primary content, or only thumbnails/quote-cards? (Affects the
  watch/read surface, not the schema.)

## Pillar 2 — The Mon–Sun grid (day-tagged content + carousels)

- **Today**: days drive check-ins, not content; the enum is Mon–Fri.
- **Gap**: no way to say "this is a Monday Motivation" or to serve a
  different one each Monday.
- **Direction**: the nullable `day_of_week` on `content_items`, plus a
  **carousel surface** — a query for `day_of_week = <today>` ∩ the viewer's
  channel, ordered by a rotation so a bank of 20 Mondays yields a fresh one
  week to week. Rotation should reuse the proven ISO-week modulo-bank
  approach already used for Workout Wednesday / daily quotes
  (`resolveBankPosition`, `src/lib/routines/dates.ts`) so every member in a
  channel sees the same pick in the same real week.
- **Open**: does the carousel live on Today, in the Library, or both? Does
  "today's day" follow the member's timezone (recommended — the platform is
  already timezone-correct, Phase 9) or a single platform day?

## Pillar 3 — Challenges (28/90-day + ad hoc)

- **Today**: greenfield. The 30/90-day *reviews* are unrelated personal
  milestones.
- **Direction**: `challenges` (definition: title, length, theme, channel),
  `challenge_days` (`challenge_id, day_index, content_item_id`) sequencing
  the spine's content, and `challenge_enrollments` (per-user progress).
  Enrollment/progress is **personal → `private` schema**; the challenge
  definition is shared content → `public`. Progress reuses the existing
  day-journey engine (`src/lib/routines/dayState.ts`) rather than inventing
  a second progress model.
- **Note the "no day numbers" nuance**: `ARCHITECTURE.md` records Anthony's
  guidance against showing day counts, because a missed-day counter reads
  as failure for people who dip in and out. A "Day 12 of 28" progress
  indicator **inside an opt-in challenge** is arguably consistent with that
  (it's a chosen programme, not passive drift) — but it directly touches
  his stated reasoning, so it is an **explicit sign-off item**, not a
  default.

## Pillar 4 — Channels & partner targeting

- **Today**: companies + skins exist; content is untargeted (all-global).
- **Direction**: `content_channel_placements` above. "Channel" = a company
  row (KP Snacks, Amazon) or NTITT-wide (no placement rows). Distribution
  becomes: given a member, show the global content plus anything placed on
  their channel, ordered by `priority`. This is the concrete meaning of
  "distribute down channels and prioritise per partner."
- **Open**: is "NTITT Direct" (public self-signup members) its own channel
  distinct from NTITT-wide, or the same? Can one item be placed on several
  named channels at once (yes, by design — the join allows it)?

## Pillar 5 — The AI brain (assistive first, never autonomous)

- **Today**: none.
- **Direction**: on upload, a server-side Claude call proposes the tags the
  spine needs — `day_of_week`, `theme`, suggested `channels`, a `summary`,
  free `tags` — and Anthony **confirms or edits** before anything
  publishes. A second, cheap use: **gap detection** ("Monday's carousel has
  only 4 items", "Challenge day 12 is empty"). This is high-value,
  low-risk, and it is the reason the spine is tag-rich in the first place.
  - **Build note**: use the Claude API via the Anthropic SDK; pick a
    current model per the `claude-api` skill (a small/fast model is right
    for tagging). Consult that skill before writing any client code — do
    not hardcode a model id from memory.
  - **Boundary**: the AI brain only ever sees **content** (what Anthony
    uploads) and **aggregate engagement signals**, never a member's private
    journal. v2 (personalised per-member/per-channel ranking) waits until
    there is engagement data to learn from, and still reads only what the
    privacy boundary already permits.
- **Open**: assistive-with-confirm is the firm recommendation for v1 — no
  auto-publish. Confirm the appetite (and budget/latency tolerance) before
  wiring v2 ranking.

## Pillar 6 — The Super Admin Studio

- **Today**: `ntitt_admin` sees a moderation queue (`/community/admin`) and
  the podcast guest list; there is **no** content management screen.
  Content is hand-entered in Supabase Studio.
- **Direction**: the highest-leverage build — an in-app, `ntitt_admin`-only
  **Studio**: upload (video id / document / image) → AI-assisted tag
  (day / theme / channel, confirm) → assign to days/challenges/channels →
  preview distribution → publish. This is what lets Anthony self-serve and
  shifts him to pure creation. It gates the same way the HR report route
  does (`requireHrAdmin()` → an equivalent `requireNtittAdmin()`), and it
  is where every other pillar plugs in.
- **Open**: none blocking — this is a build, sequenced below.

## Pillar 7 — Community depth (Reddit-style)

- **Today**: likes + flat comments, no ranking.
- **Direction**: up/down (or up-only "boost") **votes** as a score,
  `parent_comment_id` **threading**, and hot/top/new **sorting**. Likes
  migrate to votes (or become the "boost"); the existing `scope`/`board`
  axes are untouched. This is an **independent track** — it does not depend
  on the content spine — so it can proceed in parallel.
- **Open**: up/down vs up-only (up-only is gentler and fits a wellbeing
  product; up/down is more "Reddit"). Anthony's call.

## Pillar 8 — Gamification, deepened (persist · steps · rewards)

- **Today**: derived, ephemeral, non-punitive; no tables.
- **Direction**: persist a **points/XP ledger** and **awarded badges**
  (so an achievement is durable, not recomputed); add **steps** and other
  self-reported activity; add **rewards / recognition**; consider **opt-in
  leaderboards**. Also an independent track.
- **Privacy is the hard constraint here, not a nicety**:
  - **Steps and any health metric live in `private` and are
    never-reportable** — the exact standing rule that protects sleep score
    and day rating. No aggregate, view, or HR surface may expose them.
  - **Leaderboards must be opt-in and scope-safe.** A leaderboard is a
    social surface built from personal data; it may only ever show data a
    member has explicitly chosen to make visible, and must respect
    company/global scope the way the community already does. Getting this
    wrong punctures the one rule the entire data model is built around, so
    it is called out here before any table is designed.
- **Open**: which metrics beyond steps? Are leaderboards in scope at all,
  or is private/self-comparison the safer first step? Do rewards have any
  real-world (fulfilment) component or are they purely in-app recognition?

---

## Privacy invariants that must survive this chapter

Restated as a checklist because they are load-bearing and easy to erode
feature-by-feature:

1. Personal check-in/routine/review data stays private to the user;
   RLS (`auth.uid() = user_id`) is the enforcement, not app code.
2. Sleep score and day rating remain never-reportable, even in aggregate.
3. **New:** steps / any health metric join that list — `private`,
   never-reportable.
4. Aggregation stays one-way (`private → public`), service-role only.
5. The AI brain reads content and aggregates, never private journals.
6. Leaderboards (if built) are opt-in and scope-safe.
7. Content targeting never leaks one company's placements to another
   company's members beyond what "global vs placed" already implies.

---

## Phased plan (dependencies + parallel tracks)

**Track 1 — the content spine (critical path)**

- **A1. Content spine** — `content_items` + `content_channel_placements` +
  `content_type` enum + `content-assets` bucket; backfill
  `content_videos`; validated with the migration harness. *Gate to
  everything else.*
- **A2. Super Admin Studio (thin)** — `ntitt_admin`-gated: add an item, tag
  it day/theme/channel, publish. Self-serve content in, for real.
- **A3. Day carousel** — one live surface serving a day-tagged, channel-
  scoped, ISO-week-rotated carousel.
- **B. Challenges** — `challenges` / `challenge_days` / `enrollments` on the
  spine + day-journey engine.
- **C. AI brain v1 (assistive)** — tag suggestions + gap detection wired
  into the Studio.
- **E. AI brain v2** — personalised ranking, once engagement data exists.

**Track 2 — the engagement flywheel (independent, parallelisable)**

- **D1. Community depth** — votes, threading, sort. No dependency on the
  spine.
- **D2. Gamification** — persist points/badges, add steps (self-reported
  first), rewards, opt-in leaderboards — under the privacy invariants
  above.

**Recommended first slice: A1 + a thin A2 + A3.** Ship the spine, a minimal
Studio, and one live day carousel. That is the keystone — challenges, the
AI brain, and channel targeting all plug into it, and it gives Anthony a
real "I uploaded it myself and it appeared" moment. Track 2 can run
alongside if a second front is wanted.

---

## Open decisions for Anthony (the shortlist that changes the work)

1. **Challenge day counters** — is "Day 12 of 28" *inside an opt-in
   challenge* acceptable, given the standing "no day numbers" guidance?
2. **Community voting** — up/down (Reddit) or up-only "boost" (gentler,
   fits a wellbeing product)?
3. **Leaderboards** — in scope at all? If yes, opt-in only is
   non-negotiable; confirm the appetite before any design.
4. **Steps source** — self-reported first (recommended, no integration), or
   wait for wearable/health-app integration? (Either way: `private`,
   never-reportable.)
5. **Carousel home** — Today, Library, or both; timezone-local "today"
   (recommended) or one platform day.
6. **AI autonomy** — assistive-with-confirm for v1 (strong recommendation);
   confirm no auto-publish, and the budget/latency tolerance for v2.
7. **Documents** — inline viewer or download; are images ever primary
   content?

None of these block starting the content spine (A1) — the spine is correct
under every answer above; they shape the surfaces built on top of it.
