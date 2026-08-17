# Step counter & rewards

A code-verified walkthrough of how members log steps, how achievements are earned
and shared, and how company step challenges run end to end. Every claim is traced
to source. No behaviour is described from memory.

> **Two separate "steps" systems.** Keep these apart when reasoning about privacy:
> 1. **A private individual tracker** — `private.step_entries`, feeding a member's
>    personal 30/90-day review averages and their step-milestone badges. Never
>    shared with anyone.
> 2. **The company step challenge** — a *collective* team target where only an
>    aggregate is ever exposed. The individual tracker is the raw data; the
>    challenge cron is the only reader allowed to aggregate across users, and it
>    stores counts only.

---

## Part I — The individual step counter

### Entry
Two UI surfaces write a personal step count; both land in `private.step_entries`
via the same `(user_id, entry_date)` upsert key.

| Entry point | Flow |
| --- | --- |
| **Night Routine** (`src/app/(app)/night-routine`, `NightRoutineForm.tsx`) | Optional `steps` field (`min 0`, `max 200000`), labelled "Private to you. Never shared or reported." → `submitNightEntry` (`src/lib/actions/night.ts`). Steps are written **only if present**; a step-write failure never blocks routine completion. |
| **Journey "Daily steps" card** (`StepsCard.tsx`) | Numeric input → `logStepsAction` (`src/lib/actions/steps.ts`) → upsert → `revalidatePath("/journey")`. |

Both paths compute `entry_date` server-side from the member's timezone and take
`user_id` from `verifySession()`, so a member can only ever write their own row.

### Data model
`private.step_entries` (`supabase/migrations/20260813000000_step_entries.sql`):
one row per member per day; `steps int CHECK 0..200000`; `UNIQUE(user_id,
entry_date)`; own-rows-only RLS. Re-logging updates the same row (latest wins; no
per-check-in history). Bounds are enforced at both the DB (`CHECK`) and the app
(zod `.min(0).max(200000)`).

### Aggregation — review averages
`getRecentSteps` (`src/lib/steps/queries.ts`) reads the window; pure helpers in
`src/lib/steps/reviewStats.ts` compute the average. **Design choice:** the
average is over *logged days only* — un-logged days are excluded (not counted as
0), so a sparse logger isn't dragged toward zero; a logged zero-step day still
counts. Shown on the 30-day and 90-day review summaries (best-effort: any failure
hides the block).

### Known follow-ups (non-blocking)
- The 90-day "delta" compares the whole-quarter average against the first-month
  average, so it understates real month-1→month-3 change while the label reads as
  a start-to-end comparison.
- The Journey steps input has no client-side upper bound; an out-of-range value is
  rejected server-side with a "whole number" message that misdescribes it.
- The `step_entries` migration header comments ("no aggregate anywhere", "not
  exposed via the API") are now stale — the review summaries aggregate it
  privately, and RLS (not API exposure) is the real boundary.

---

## Part II — Badges & rewards

### Definitions
No DB table or enum — badges are a TypeScript catalogue in
`src/lib/gamification/badges.ts` plus a challenge-badge label map. Two families:

| Key | Label | Earn rule |
| --- | --- | --- |
| `first_week` | First Week | `activeDayCount ≥ 7` |
| `ten_days` | 10 Days | `activeDayCount ≥ 10` |
| `first_post` | First Post | `postCount ≥ 1` |
| `night_owl` | Night Owl | `nightCount ≥ 1` |
| `five_wins` | 5 Wins | `winsCount ≥ 5` |
| `thirty_days` | 30 Days | `activeDayCount ≥ 30` |
| `steps_10k_club` | 10K Club | `maxSingleDaySteps ≥ 10000` |
| `steps_week_streak` | Week Streak | `bestStepStreak ≥ 7` |
| `steps_30_day_mover` | 30 Day Mover | `bestStepStreak ≥ 30` |
| `team_mvp` | Team MVP | Challenge outcome — top contributor (private). Cron-awarded. |
| `challenge_complete` | Challenge Complete | Challenge outcome — every contributor, if target hit. Cron-awarded. |

Step milestones use monotonic ("best-ever") helpers in
`src/lib/steps/milestones.ts`, so a step badge can never un-earn.

### Award & storage
- **Catalogue badges** are persisted on `/home` load: `<BadgeSync />` →
  `syncEarnedBadgesAction` re-derives stats server-side, evaluates the catalogue,
  and upserts only newly-earned keys (`ignoreDuplicates`).
- **Challenge badges** are awarded by the nightly cron at challenge end (see Part
  III).
- Storage: `private.earned_badges`, `(user_id, badge_key)` unique, **select +
  insert only** (no update/delete policy) — once earned, a member can't edit or
  remove a badge.

### Display & sharing
Badges live on the Journey page (`JourneyBadges`); Home shows only the count.
Sharing is opt-in: `ShareBadgeButton` → `shareBadgeAction` verifies ownership
against the member's own `earned_badges`, then posts a `community_posts` row to
the wins board carrying `shared_badge_key`.

### Known follow-ups (non-blocking)
- Because catalogue badges are only persisted on `/home`, a member who crosses a
  threshold and visits `/journey` first sees a Share button that fails until
  `/home` is loaded. Fix: persist on Journey load too, or add a backfill.
- A "private" Team MVP is one tap from public (it renders with a Share slot).
- Share dedup is a read-then-insert with no unique constraint on `(user_id,
  shared_badge_key)`.

---

## Part III — The company step challenge

> **The one rule everything bends around:** a company only ever sees an
> **aggregate** — never an individual's steps, and never who opted in. There is no
> individual leaderboard anywhere in the system.

### Data model
`supabase/migrations/20260813020000_company_step_challenges.sql`:

| Table | Schema | Purpose |
| --- | --- | --- |
| `company_step_challenges` | public | HR-authored definition: `target_steps`, `reward_type`, `reward_name`, dates, `status`. |
| `company_step_challenge_optins` | private | Private opt-in toggle (`opted_in bool default true`); own-rows-only, so opting out is invisible to everyone. |
| `company_step_totals` | public | The aggregate — the only steps window HR/staff get. Select-only; written only by the service-role cron. |

Guardrails: the self-signup pool (`DIRECT_COMPANY_ID`) is barred at the DB CHECK;
a partial unique index enforces one `active` challenge per company; default is
opted-in.

### HR setup → staff experience
- **HR** — workspace "Challenges" → `/workspace/challenges` (`requireHrAdmin`).
  `ChallengeSetupForm` → `createChallengeAction` (validates, rejects the direct
  pool, rejects a duplicate active challenge, **launches straight to `active`**).
  `ChallengeAdminTile` shows team total / target, opt-in %, target-hit — honouring
  suppression below the floor.
- **Staff** — `ChallengeView` shows company name, collective progress,
  contributors, days left, the reward, and the private opt-in toggle. It shows
  **only the aggregate** — no personal-contribution figure.

### Aggregation cron
`src/app/api/jobs/aggregate-step-challenges/route.ts`, daily at 02:30 UTC, auth by
`CRON_SECRET` (fails closed if unset). Each night it sums opted-in members'
`step_entries` in `[starts_on, ends_on]`, applies the **k-anonymity floor**
(`computeStepTotals`: below 5 contributors → total suppressed to 0), and upserts
one `company_step_totals` row. Full recompute, idempotent. Reads are paged with a
total order on a unique column (hardened in #74/#75) to avoid silent truncation
and cross-page row skips.

### Notifications, rewards & badges
- **Target-hit** fires once on the `!wasReached && targetReached && !suppressed`
  transition — HR admins only, email only (Brevo), best-effort.
- **Reward** — the company's `reward_type` / `reward_name`, shown on both tiles.
  The company hosts and administers it; the platform surfaces "the reward is now
  unlocked; it's administered by your company" and never fulfils it (see below).
- **Challenge-end badges** — `team_mvp` (top contributor, private) +
  `challenge_complete` (all contributors, only if target hit), both gated on the
  floor.

### Known follow-ups (non-blocking)
- **Final-day timezone gap** — unlike the sibling participation cron (which
  re-aggregates a 3-day settling window), this cron finalizes as soon as UTC
  `todayIso > ends_on` and never recomputes, so a western-timezone member's final
  local day can be excluded from the total, target check, and badges.
- Target-hit is HR-only / email-only; staff learn of success only if they open the
  screen.

---

## Reward model — company-hosted & company-funded

**Direction (Amazon, KP Snacks and every partner portal): the prize is the
company's to choose, fund and host.** The platform's job is to run the challenge
fairly, protect member privacy, and tell HR the moment the target is hit — nothing
more. This matches the code: `reward_type` spans company-fundable perks
(`team_experience`, `extra_day_off`, `charity_donation`, `prize_draw`),
`reward_name` is free text the company sets, and the target-hit email says the
reward "is administered by your company."

Why this framing:
- **It matches the schema** — no platform money or logistics are ever in the loop.
- **It keeps NTITT out of fulfilment** — the platform reports the outcome and hands
  off; lower operational and commercial risk.
- **It scales per company** — each partner sets a prize that fits their culture and
  budget, rather than a one-size reward.

### Retired: the "Anthony visit" reward
The `anthony_visit` reward type has been **removed from selection**. It was an
NTITT-run, paid, in-person booking gated behind an HMAC-signed availability-confirm
link — not a company-funded prize, and not really a prize at all. Removing it:
- Drops `anthony_visit` from the selectable reward types and the create-action
  schema (so no new challenge can use it).
- Removes the whole confirm-email flow: `sendAnthonyVisitEmail`, the
  `challengeConfirm.ts` HMAC helpers, the `/api/challenges/[id]/confirm` route, and
  the `ANTHONY_VISIT_NOTIFY_EMAIL` env var. Every challenge now launches straight to
  `active`.
- Simplifies `createChallengeAction`, `getAdminChallengeView`, and
  `ChallengeAdminTile` (the `pending_confirmation` UI state is gone).

The `pending_confirmation` status value and the `anthony_visit` value remain valid
in the historical DB `CHECK` constraints (they are a harmless superset now that no
code writes them); the migration was left untouched rather than edited after the
fact. The `anthony_visit` label is kept in `rewardTypeLabel`'s map purely so any
historical row still renders a human name.
