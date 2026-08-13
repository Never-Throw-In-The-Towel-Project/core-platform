// Pure company-step-challenge helpers -- no DB, no "server-only", so the
// privacy-critical aggregation rule is unit-tested in isolation (challenge.test.ts).
// These reduce opted-in members' per-member step sums to the single aggregate a
// company is allowed to see, and drive the staff progress bar.

/**
 * k-ANONYMITY FLOOR. The team total is a sum of opted-in members' *private*
 * steps; with too few contributors the total effectively reveals one person's
 * count. Below this many contributors we suppress the total entirely. 5 is the
 * product decision (invited clients only + hide-under-5). This is enforced in
 * the aggregation writer, so a suppressed total is stored as 0 and never lands
 * in a table the company can read.
 */
export const STEP_CHALLENGE_MIN_CONTRIBUTORS = 5;

export interface StepTotalsResult {
  /** The team total, or 0 when suppressed by the floor. */
  totalSteps: number;
  /** Opted-in members who actually contributed steps ( > 0 ). */
  contributorCount: number;
  /** True only when not suppressed and the total has reached the target. */
  targetReached: boolean;
  /** True while the contributor count is below the k-anon floor. */
  suppressed: boolean;
}

/**
 * Reduce opted-in members' per-member step sums to the single aggregate the
 * company may see, applying the k-anon floor. `memberSums` is one number per
 * opted-in member = that member's total steps in the challenge window. Members
 * contributing 0 don't count toward the floor (they aren't really contributing),
 * and when suppressed the total is forced to 0 so the caller never persists a
 * revealing number.
 */
export function computeStepTotals(
  memberSums: number[],
  targetSteps: number,
  minContributors: number = STEP_CHALLENGE_MIN_CONTRIBUTORS
): StepTotalsResult {
  const contributingSums = memberSums.filter((s) => s > 0);
  const contributorCount = contributingSums.length;

  if (contributorCount < minContributors) {
    return { totalSteps: 0, contributorCount, targetReached: false, suppressed: true };
  }

  const totalSteps = contributingSums.reduce((a, b) => a + b, 0);
  return { totalSteps, contributorCount, targetReached: totalSteps >= targetSteps, suppressed: false };
}

/** Percentage of the company's employees who are opted in (0-100, rounded). */
export function optedInPercent(optedInCount: number, headcount: number): number {
  if (headcount <= 0) return 0;
  return Math.round((optedInCount / headcount) * 100);
}

/**
 * Whole days remaining until (and including) the challenge's last day. 0 once
 * the end date has passed. UTC calendar math on the date-only strings so it
 * never shifts a day.
 */
export function daysRemaining(endsOnIso: string, todayIso: string): number {
  const end = new Date(`${endsOnIso}T00:00:00Z`).getTime();
  const today = new Date(`${todayIso}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((end - today) / 86_400_000));
}

/** Progress toward the target as a 0-100 percentage (capped), for the bar. */
export function progressPercent(totalSteps: number, targetSteps: number): number {
  if (targetSteps <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((totalSteps / targetSteps) * 100)));
}

/**
 * Reward types HR can select when setting up a challenge (brief §2/§4). The
 * company funds and administers the reward; NTITT only displays it and confirms
 * when the target is hit. `anthony_visit` is special: picking it does NOT launch
 * immediately -- the challenge is created 'pending_confirmation' and Anthony is
 * emailed a signed link to confirm availability, which flips it live.
 */
export const CHALLENGE_REWARD_TYPES = [
  { value: "team_experience", label: "Team experience (team lunch, day out)" },
  { value: "extra_day_off", label: "Extra day off" },
  { value: "charity_donation", label: "Charity donation in the company's name" },
  { value: "prize_draw", label: "Prize draw (e.g. vouchers)" },
  { value: "anthony_visit", label: "Anthony Hutton in-person visit (needs his confirmation)" },
] as const;

const REWARD_TYPE_LABELS: Record<string, string> = {
  team_experience: "Team experience",
  extra_day_off: "Extra day off",
  charity_donation: "Charity donation",
  prize_draw: "Prize draw",
  anthony_visit: "Anthony Hutton in-person visit",
};

/** Human label for a stored reward_type (falls back to the raw value). */
export function rewardTypeLabel(value: string): string {
  return REWARD_TYPE_LABELS[value] ?? value;
}
