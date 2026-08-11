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

export interface Badge {
  key: string;
  /** Short label as shown in the grid (uppercased by the component). */
  label: string;
  /** One-line meaning, for the title/tooltip and a11y. */
  description: string;
  earned: boolean;
}

/**
 * Evaluate every badge against the user's real stats. Order is the display
 * order in the grid (earned ones read first because most users will have the
 * early ones); the component paints earned vs. locked.
 */
export function evaluateBadges(stats: BadgeStatsInput): Badge[] {
  const defs: Badge[] = [
    {
      key: "first_week",
      label: "First Week",
      description: "Seven active days in.",
      earned: stats.activeDayCount >= 7,
    },
    {
      key: "ten_days",
      label: "10 Days",
      description: "Ten active days in.",
      earned: stats.activeDayCount >= 10,
    },
    {
      key: "first_post",
      label: "First Post",
      description: "Shared your first post with the community.",
      earned: stats.postCount >= 1,
    },
    {
      key: "night_owl",
      label: "Night Owl",
      description: "Closed out a night routine.",
      earned: stats.nightCount >= 1,
    },
    {
      key: "five_wins",
      label: "5 Wins",
      description: "Won five rounds -- five completed check-ins or routines.",
      earned: stats.winsCount >= 5,
    },
    {
      key: "thirty_days",
      label: "30 Days",
      description: "Reached your 30-day review.",
      earned: stats.activeDayCount >= 30,
    },
  ];

  return defs;
}

export function countEarned(badges: Badge[]): number {
  return badges.filter((b) => b.earned).length;
}
