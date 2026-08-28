/**
 * Badge set for the Today right-rail badge grid and the "N badges" stat.
 *
 * ⚠️ PARTIALLY OPEN PRODUCT DECISION. The design handoff shows a badge grid
 * (First Week, 10 Days, First Post, Night Owl, 5 Wins, 30 Days) but does not
 * specify the full catalogue or its exact criteria. The set below is derived
 * ENTIRELY from data the platform already records -- no new tracking, no
 * invented state -- so it is honest for any real user today, and it is
 * deliberately non-punitive: a badge can only be earned, never lost, and a
 * locked badge shames nothing (it just shows the target).
 *
 * The catalogue and thresholds still need Anthony's sign-off before they're
 * treated as final; keeping them in this one file makes that a single edit.
 */

export interface BadgeStatsInput {
  activeDayCount: number;
  morningCount: number;
  nightCount: number;
  themedCount: number;
  /** Community posts authored by the user (any board). */
  postCount: number;
  /** Total completed sessions = "wins" ("win the round"). */
  winsCount: number;
  /**
   * Highest steps recorded on any single day (0 if steps never logged). The two
   * step figures below are MONOTONIC -- a best-ever max and a best-ever streak,
   * derived from the member's own private step_entries -- so the step badges,
   * like every other badge, can be earned but never lost.
   */
  maxSingleDaySteps: number;
  /** Longest run of consecutive days with a logged step entry (best ever). */
  bestStepStreak: number;
}

/** A badge's static identity, independent of whether it's been earned. */
export interface BadgeDef {
  key: string;
  /** Short label as shown in the grid (uppercased by the component). */
  label: string;
  /** One-line meaning, for the title/tooltip and a11y. */
  description: string;
}

export interface Badge extends BadgeDef {
  earned: boolean;
}

// The single source of truth for the catalogue: display order, labels, and the
// earn rule per badge. Everything else (the grid, the count, persistence, the
// label lookup) derives from this list -- so the still-open thresholds remain a
// one-place edit (see the file header).
const CATALOGUE: { def: BadgeDef; isEarned: (s: BadgeStatsInput) => boolean }[] = [
  {
    def: { key: "first_week", label: "First Week", description: "Seven active days in." },
    isEarned: (s) => s.activeDayCount >= 7,
  },
  {
    def: { key: "ten_days", label: "10 Days", description: "Ten active days in." },
    isEarned: (s) => s.activeDayCount >= 10,
  },
  {
    def: { key: "first_post", label: "First Post", description: "Shared your first post with the community." },
    isEarned: (s) => s.postCount >= 1,
  },
  {
    def: { key: "night_owl", label: "Night Owl", description: "Closed out a night routine." },
    isEarned: (s) => s.nightCount >= 1,
  },
  {
    def: { key: "five_wins", label: "5 Wins", description: "Won five rounds — five completed check-ins or routines." },
    isEarned: (s) => s.winsCount >= 5,
  },
  {
    def: { key: "thirty_days", label: "30 Days", description: "Reached your 30-day review." },
    isEarned: (s) => s.activeDayCount >= 30,
  },
  // Step milestones (brief §3). Earned from the member's own private steps and,
  // like all badges here, only shown to them -- the brief's "visible to others
  // only if the user shares" is a later, separate opt-in surface, never automatic.
  {
    def: { key: "steps_10k_club", label: "10K Club", description: "Logged a 10,000-step day." },
    isEarned: (s) => s.maxSingleDaySteps >= 10000,
  },
  {
    def: { key: "steps_week_streak", label: "Week Streak", description: "Logged steps seven days in a row." },
    isEarned: (s) => s.bestStepStreak >= 7,
  },
  {
    def: { key: "steps_30_day_mover", label: "30 Day Mover", description: "Logged steps thirty days in a row." },
    isEarned: (s) => s.bestStepStreak >= 30,
  },
];

/** Every badge's static definition, in display order. */
export const BADGE_DEFS: BadgeDef[] = CATALOGUE.map((c) => c.def);

/** A badge granted at a moment by a job/action (never derived from live stats),
 *  so a full-catalogue view can show it locked with an honest "how you earn it"
 *  line instead of a numeric target. */
export interface AwardedBadgeDef extends BadgeDef {
  /** Shown on a LOCKED awarded tile -- how it's earned (no numeric progress). */
  earnHint: string;
}

// Challenge-outcome + habit badges (brief §3). NOT derived from personal stats
// (evaluateBadges) -- they're written straight into earned_badges by the
// service-role aggregation job (Team MVP / Challenge Complete) or by
// markHabitDayAction (Clean Streak), so they carry no live earn rule here, just a
// static definition for the catalogue views (the Journey Trophy Room shows each
// earned, or locked with its earnHint). Team MVP is private to the single top
// contributor; Challenge Complete goes to every contributor when the team hits
// the target; Clean Streak is earned the first time a member reaches their own
// habit-quit goal (and never names the habit).
export const AWARDED_BADGES: AwardedBadgeDef[] = [
  {
    key: "challenge_complete",
    label: "Challenge Complete",
    description: "Your team hit the target in a company step challenge.",
    earnHint: "Finish a company step challenge",
  },
  {
    key: "team_mvp",
    label: "Team MVP",
    description: "Top step contributor when a company challenge ended.",
    earnHint: "Top your team in a step challenge",
  },
  {
    key: "habit_complete",
    label: "Clean Streak",
    description: "Reached your own clean-streak goal.",
    earnHint: "Reach your Clean Streak goal",
  },
];

// Label lookup for a persisted awarded badge_key, derived from the one list above
// so the label lives in a single place.
const CHALLENGE_BADGE_LABELS: Record<string, string> = Object.fromEntries(
  AWARDED_BADGES.map((b) => [b.key, b.label])
);

/** Human label for a persisted badge_key (falls back to the key itself). */
export function badgeLabel(key: string): string {
  return BADGE_DEFS.find((d) => d.key === key)?.label ?? CHALLENGE_BADGE_LABELS[key] ?? key;
}

/**
 * A short, non-punitive "what's left" hint for a LOCKED badge, shown under it in
 * the Journey grid (the 5-journey design's "5 days to go" / "3 to go"). Derived
 * from the same stats the earn rule uses; it is only ever a target to move
 * toward, never a scold, and it never reads "0 to go" (that would be a
 * contradiction with the badge still being locked). Falls back to a neutral
 * nudge for any key without a specific hint.
 */
const PROGRESS_HINT: Record<string, (s: BadgeStatsInput) => string> = {
  first_week: (s) => `${Math.max(1, 7 - s.activeDayCount)} days to go`,
  ten_days: (s) => `${Math.max(1, 10 - s.activeDayCount)} days to go`,
  first_post: () => "Share a post",
  night_owl: () => "One night routine",
  five_wins: (s) => `${Math.max(1, 5 - s.winsCount)} wins to go`,
  thirty_days: (s) => `${Math.max(1, 30 - s.activeDayCount)} days to go`,
  steps_10k_club: () => "Log a 10k day",
  steps_week_streak: () => "7-day step streak",
  steps_30_day_mover: () => "30-day step streak",
};

export function badgeProgressHint(key: string, stats: BadgeStatsInput): string {
  return PROGRESS_HINT[key]?.(stats) ?? "Keep going";
}

/**
 * Evaluate every badge against the user's real stats. Order is the display
 * order in the grid (earned ones read first because most users will have the
 * early ones); the component paints earned vs. locked.
 */
export function evaluateBadges(stats: BadgeStatsInput): Badge[] {
  return CATALOGUE.map((c) => ({ ...c.def, earned: c.isEarned(stats) }));
}

export function countEarned(badges: Badge[]): number {
  return badges.filter((b) => b.earned).length;
}

/**
 * The keys of badges earned *now* that aren't already persisted -- i.e. the
 * badges to award. Pure, so it's unit-tested in isolation.
 */
export function newlyEarnedKeys(badges: Badge[], persistedKeys: Iterable<string>): string[] {
  const already = new Set(persistedKeys);
  return badges.filter((b) => b.earned && !already.has(b.key)).map((b) => b.key);
}
