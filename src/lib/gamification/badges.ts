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
    def: { key: "five_wins", label: "5 Wins", description: "Won five rounds -- five completed check-ins or routines." },
    isEarned: (s) => s.winsCount >= 5,
  },
  {
    def: { key: "thirty_days", label: "30 Days", description: "Reached your 30-day review." },
    isEarned: (s) => s.activeDayCount >= 30,
  },
];

/** Every badge's static definition, in display order. */
export const BADGE_DEFS: BadgeDef[] = CATALOGUE.map((c) => c.def);

/** Human label for a persisted badge_key (falls back to the key itself). */
export function badgeLabel(key: string): string {
  return BADGE_DEFS.find((d) => d.key === key)?.label ?? key;
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
