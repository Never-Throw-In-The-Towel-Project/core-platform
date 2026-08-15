# Feature & Screen Inventory — Never Throw In The Towel

A complete map of everything that exists in the platform today, written for the
**design team** doing a pre-launch polish pass. Every screen, what it's for, the
states it can be in, and — flagged throughout — what's **real** vs. what's a
**placeholder / open decision** you should weigh in on.

> **Companion docs:** `docs/PLATFORM_STRUCTURE.md` (how the platform is organised
> by role), `docs/DESIGN.md` / `designs/` (the visual system), `docs/ARCHITECTURE.md`
> (the privacy boundary). This file is the *what exists*; those are the *how it's
> built* and *how it should look*.

---

## How to read this

- **Journeys, not just pages.** The platform is four distinct experiences keyed to
  *who you are*. A screen's job only makes sense inside its journey.
- **States matter for design.** For each screen we call out the **empty**,
  **loading**, and **done/success** states, since those are where polish lives.
- 🟢 **Live** = built and working. 🟡 **Partial / placeholder** = visible but stubbed
  or copy-draft. 🔵 **Design-pending** = an explicit open decision for you.

---

## The big picture

**Four journeys, three hosts, four roles.**

| Journey | Host | Who | In one line |
|---|---|---|---|
| **The Core** (public) | `neverthrowinthetowel.uk` | anyone | Marketing "taster" site |
| **The Member App** | same host, behind login (+ company subdomains) | `employee` (+ everyone) | The daily wellbeing app |
| **The Company Workspace** | `{company}.neverthrowinthetowel.uk` | `hr_admin` | Aggregate-only HR dashboard |
| **The Control Tower** | `admin.neverthrowinthetowel.uk` | `ntitt_admin` | NTITT runs content, community, companies |

**Co-branding:** on a partner subdomain (`kp-snacks.neverthrowinthetowel.uk`) the
public + login + member surfaces skin to the company (logo, top colour strip,
welcome copy), and public self-signup is hidden — partner staff join by invite.

**Design system in force:** "Modernist" — flat uppercase micro-labels with wide
letter-spacing, hairline rules, a single brand red accent (`--brand-accent`),
grayscale documentary photography, generous whitespace, the dark "ink" member
app vs. the light marketing/admin shells.

**The one universal element:** the **"I want someone to check in with me"** support
button appears on *every* screen in the platform (see Cross-cutting systems).

---

## Journey 1 — The Core (public marketing) 🟢

No login. A free taster that sells the movement and routes people to sign up.
Shared chrome: `MarketingNav` (top colour strip, What I Do / Documentary / Podcast
/ Sign in, + "Create account" only off-partner) and a footer with a **pre-auth
crisis helpline** and Privacy/Terms. Light theme.

| Screen | URL | What it does | Design notes / states |
|---|---|---|---|
| **Landing** | `/` | The pitch: hero, offerings, testimonials, partners | Co-brands on a company host (`{Company} × NTITT` headline, logo, welcome copy; hides the partner logo-wall + podcast CTA). Animated partner logo marquee with a **reduced-motion fallback**. Hero CTAs: Sign in, Watch the Documentary. |
| **Documentary** | `/documentary` | Sells "After the Cameras Stopped" | YouTube trailer embed; rent/buy-on-Amazon note. |
| **Podcast** | `/podcast` | Podcast + guest blurbs | Outbound "See more on YouTube". |
| **What I Do** | `/what-i-do` | Anthony's offerings hub | Two cards → Barbershop, Coaching. |
| **Coaching** | `/what-i-do/coaching` | The Thrive Project 1-to-1 | "Contact Anthony" **mailto** CTA. |
| **Pop-Up Barbershop** | `/what-i-do/pop-up-barbershop` | Workplace barbershop service | Client logos (L'Oréal, KP Snacks); "Contact Anthony" mailto. |
| **Privacy** | `/privacy` | UK-GDPR privacy policy | 🟡 Carries a **"draft" notice banner** — copy needs legal sign-off before launch. |
| **Terms** | `/terms` | Terms of service | 🟡 Same **draft banner**; "not a medical/crisis service" disclaimer. |

---

## Journey 2 — The Member App (the wellbeing app) 🟢

The heart of the product. Requires login; unfinished onboarding bounces to
`/onboarding`. Dark "ink" theme. Chrome: `AppHeader` (desktop tabs Today /
Community / Library / Journey, company chip, Settings, support link) and, on
mobile, a sticky support bar + `BottomNav`.

### The daily loop — "Today" and the routines

| Screen | URL | What it does | Design notes / states |
|---|---|---|---|
| **Today / home** | `/home` | The daily hub | Time-of-day **phase hero** (morning / themed check-in / night / weekend), each with its own copy + CTA. Top **ProgressBand**: completion ring, rank, streak, wins, badges, days-to-next-review, and the **Story Rail** (see 🔵 below). Right rail: week strip, active challenges, badges, wins board, review progress. If a 30/90-day review is due, the screen is **taken over** by that review. **Empty-ish states** everywhere degrade gracefully ("nothing done yet"). |
| **Morning Routine** | `/morning-routine` | Morning check-in | "Win the morning" framing; sleep score; "Day N" counter. |
| **Night Routine** | `/night-routine` | Evening wind-down | The one intentionally **dark** screen; day-rating; **steps-today** field (prefilled). |
| **Themed check-in** | `/checkin` | Today's weekday ritual | Different every weekday: Mon **goals**, Tue **podcast episode**, **Workout Wednesday** (4 difficulty tiers), Thu **quote**, **Feel-Good Friday** (echoes Monday's goals). `?day=` opens a catch-up day. |
| **Sunday Setup** | `/sunday-setup` | Plan the week (Sun only) | Redirects to /home off-Sunday. |
| **Weekly Review** | `/weekly-review` | Reflect (Fri–Sun) | Redirects to /home outside the window. |

> **Privacy tone throughout:** every routine screen reminds the member their
> answers are private ("private to you"). This is a core emotional-design promise —
> keep it prominent in any redesign.

### Milestone reviews

| Screen | URL | What it does | Design notes |
|---|---|---|---|
| **30-day review** | `/reviews/30-day` | Fill in the 30-day reflection | Only reachable when actually due (else redirect). |
| **30-day summary** | `/reviews/30-day/summary` | Read it back / export | Read-only; **avg daily steps** stat; commitment "signature"; **Print / Save-as-PDF**. |
| **90-day review** | `/reviews/90-day` | The quarter review | Shows a **comparison column** vs the 30-day self-assessment. |
| **90-day summary** | `/reviews/90-day/summary` | Read back / export | Steps delta vs first 30 days; habit-completion summary; PDF export. |

### Journey, settings, challenges, library

| Screen | URL | What it does | Design notes / states |
|---|---|---|---|
| **My Journey** | `/journey` | Personal history (private) | Stats, week-by-week highlights, a **sleep+mood bar chart**, 7-day steps card, earned badges (each with an opt-in **Share to wins board**), 30/90-day milestone cards, step-challenge entry. |
| **Settings** | `/settings` | Account + data | Timezone, reminder times, **push toggle**, **Download my data** (GDPR), **Delete account**. |
| **Step challenge** | `/step-challenge` | Company steps challenge | Team aggregate toward a target (**never individual**), private opt-in toggle, log steps. **Empty state** when none active. |
| **Challenges** | `/challenges` | Guided multi-day programmes | Progress shown as "X of Y done" — **never "behind"** (deliberate, non-punitive). |
| **Challenge detail** | `/challenges/[id]` | Do a challenge | Join, per-day cards (prompt + linked content), mark-day-complete, progress bar. Admins can preview drafts. |
| **Content library** | `/content` | Search/browse content | **Search-first** ("divorce", "grief"); category tabs; quick-topic chips; day-of-week rotating carousel; results by type (Watch / Read / View). |
| **Content item** | `/content/[id]` | Watch/read one item | Vimeo player, image, or document viewer + "Open ↗". |

### Community

Chrome: `CommunityTabs` — Feed / My Company / Wins Board / Guidelines. "My
Company" is **hidden for Direct members** (self-signup pool). First visit hits a
**guidelines gate**; posting needs opt-in.

| Screen | URL | What it does | Design notes / states |
|---|---|---|---|
| **Feed** | `/community` | NTITT-wide feed | Compose (text + **photo**), sort, like, **2-level threaded comments**, **report post**. Sidebar carries the **podcast guest opt-in**. |
| **My Company** | `/community/company` | Company-only feed | Same view, company scope. Redirects Direct members out. |
| **Wins Board** | `/community/wins` | Celebratory wins | Tiled grid; "N wins this week"; compose tile; badges surface only by choice. |
| **Guidelines** | `/community/guidelines` | The rules + accept gate | Accept button sets `community_opt_in`. |

---

## Journey 3 — The Company Workspace (HR) 🟢

`hr_admin` only, at `/workspace/*`. **The privacy firewall is the whole point:**
HR sees **company-wide aggregate numbers only — never names, answers, scores, or
who used support.** Enforced by RLS, not config. Chrome: "{Company} Workspace",
`WorkspaceNav` (Overview / People / Challenges / Reports), link back to their own
Today screen.

| Screen | URL | What it does | Design notes |
|---|---|---|---|
| **Overview** | `/workspace` | Aggregate wellbeing dashboard | KPIs (check-in completion, participation trend, **support-button use count only**, review-completion counts), trend chart, per-weekday bars. Explicit **"numbers only, no names"** banner — a trust-critical design element. |
| **People** | `/workspace/people` | Invite staff | Invite form; role/company derived from the caller, not the form. |
| **Challenges** | `/workspace/challenges` | Run the step challenge | Create challenge, or view the k-anonymised team total. |
| **Reports** | `/workspace/reports` | Download the impact report | 90-day **PDF**; explicit "**Not available to you**" list (individual data). |

---

## Journey 4 — The Control Tower (NTITT admin) 🟢

`ntitt_admin` only, at `admin.neverthrowinthetowel.uk` → `/admin/*`. Light shell.
Chrome: `AdminNav` (Content / Challenges / Moderation / Podcast / Companies).

| Screen | URL | What it does | Design notes |
|---|---|---|---|
| **Control Tower home** | `/admin` | Landing | Cards to each tool. |
| **Content Studio** | `/admin/content` | Author/tag/target/publish content | Create item (video/doc/image, category, day, tags, channel targeting); **bulk import**; **AI tag suggestions** (assistive only); **coverage-gap report** (empty days/themes); item list with Live/Draft + publish/unpublish/delete/**edit**. |
| **Edit content** | `/admin/content/[id]/edit` | Edit an item | Prefilled form incl. channel placements. |
| **Challenges index** | `/admin/challenges` | Author programmes | Create programme; list with day-count + Live/Draft. |
| **Challenge builder** | `/admin/challenges/[id]` | Sequence a challenge's days | Add days with prompts + linked library content; "Preview member view". |
| **Moderation** | `/admin/moderation` | Review reported posts | Queue with reporter, post, resolve/remove. **"All clear"** empty state. |
| **Podcast guests** | `/admin/podcast` | Review guest interest | Private list of opted-in members + anonymity preference + consent date. |
| **Companies** | `/admin/companies` | Manage partner portals | **New Company wizard** (branded portal + first HR invite in one step, live URL preview); company list; add-staff form. |
| **Edit company** | `/admin/companies/[id]` | Branding + support contacts | Name, welcome copy, **support-contact PII** (first-aider phone/email), **brand colours**. Slug read-only. |

---

## Auth & onboarding 🟢

| Screen | URL | What it does | Design notes |
|---|---|---|---|
| **Login** | `/login` | Sign in | Magic-link or password; co-brand logo on a company host; crisis helpline. |
| **Signup** | `/signup` | Create a direct account | **Redirects to login on partner hosts** (invite-only there). |
| **Onboarding** | `/onboarding` | First-run | **Member flow** (4 steps: welcome → "what you write is yours" privacy → optional password → reminder times + push + display name). **HR/NTITT admins** get a shorter, role-appropriate flow. Support button present throughout. |

---

## Cross-cutting systems (not a single screen)

- **🚨 Ask-for-Support — "I want someone to check in with me".** The single most
  important safety feature. On **every screen** (member app, workspace, admin,
  onboarding) + a pre-auth variant on marketing/login. Full accessible modal
  (focus trap, Escape, scroll-lock). Fields: stay-anonymous, name, urgency
  (check-in / talk today / **urgent**), contact method. Submitting alerts the
  company's real support contact by **SMS + email**, with response-time
  escalation. **Never** auto-triggered by anything the member writes — always
  person-led. *Design: this must always be reachable and unmistakable; the urgent
  path shows a helpline number.*
- **Reminders / push.** Per-user morning/night/sunday reminder times + timezone;
  Web Push; delivered by cron in each user's own timezone.
- **Badges / gamification.** Earn-only, non-punitive, private by default (First
  Week, 10 Days, Night Owl, step badges, challenge badges…). Member can **choose**
  to share a badge to the wins board. Rank/streak/wins ring on Today.
- **Step challenge.** HR-run, company-wide, **k-anonymised** team totals; member
  opt-in; pop-up-visit reward; badges on completion.
- **Community moderation.** Report on every post; guidelines gate; ntitt_admin-only
  moderation queue.
- **Content-OS.** One shared library, authored in the Studio, targeted per-company
  by channel, sequenced into challenges, surfaced by day-of-week.
- **GDPR / data rights.** Self-serve **data export** + **account deletion**;
  PDF review summaries; podcast consent record with withdrawal; the aggregate-only
  employer boundary.
- **Co-branding / multi-tenant.** Per-company skin, logo, welcome copy, and support
  routing; self-serve portal creation; cross-subdomain SSO.

---

## 🔵 Known placeholders & open design decisions (before launch)

These are the "finish or cut" calls the design team should make:

1. **Story Rail (Today screen).** The Anthony / Barbershop / Meet-up / Episode
   circular tiles are **hard-coded and non-interactive by design** — the full-screen
   story viewer "is not yet designed (an open decision in the handoff)". Decide:
   build a real stories viewer, **repurpose the tiles as links** to existing content
   (podcast, barbershop page, coaching), or cut the rail. *(`StoryRail.tsx`)*
2. **Privacy & Terms copy.** Both carry a **"draft" banner** — needs legal review +
   removal of the banner before launch.
3. **Partner brand colours.** New companies seed with `null` brand colours, so a
   partner portal shows the NTITT red until colours are set in Admin → Companies.
   Consider making brand colour **required** in the New-Company wizard.
4. **Empty states.** Several surfaces ("no challenges yet", "no published content",
   "all clear" moderation, empty wins board) render gently but are worth a design
   pass so a fresh company doesn't feel hollow on day one.
5. **PDF exports.** Review summaries + impact report use the browser's print-to-PDF;
   a designed print stylesheet would make them feel first-class.

---

*Generated from a full read of all route files under `src/app` plus the shared
navigation, the Ask-for-Support flow, community, badges, onboarding, and
tenant-resolution code. Kept in-repo so it stays close to the source of truth —
update it as screens change.*
