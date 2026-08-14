/**
 * Rank ladder for the Today progress band.
 *
 * ⚠️ OPEN PRODUCT DECISION. The design handoff states only that the rank is
 * "Contender" around day 12 ("the rank ladder is named 'Contender' at day 12;
 * the rest of the ladder is undecided"). "Contender" is therefore treated as
 * canonical for the pre-30-day tier; every other tier name below is a
 * PROVISIONAL placeholder and must be signed off by Anthony before it's shown
 * as final. Keep the whole ladder in this one file so renaming it is a
 * one-line change and never a hunt through components.
 *
 * Tiers are pegged to the *active-day* milestones the product already defines
 * (the 30- and 90-day reviews) rather than invented thresholds, so the ladder
 * can't drift from the review cadence. Nothing here is punitive: a rank only
 * ever goes up with engagement, never down for a missed day.
 */

export interface Rank {
  name: string;
  /** True once product has confirmed this tier's name (only Contender today). */
  confirmed: boolean;
}

export function resolveRank(activeDayCount: number): Rank {
  if (activeDayCount >= 90) return { name: "Cornerman", confirmed: false };
  if (activeDayCount >= 30) return { name: "Challenger", confirmed: false };
  // Canonical from the handoff.
  return { name: "Contender", confirmed: true };
}

/**
 * The rank name that is safe to SHOW a user. A provisional (not-yet-signed-off)
 * tier name falls back to the canonical "Contender" so unapproved copy never
 * reaches a user before Anthony signs the ladder off. Once the names are
 * confirmed (flip `confirmed: true` above), this returns them unchanged -- so
 * approving the ladder is still the one-line change this file promises.
 */
export function displayRankName(rank: Rank): string {
  return rank.confirmed ? rank.name : "Contender";
}
