/**
 * Pure normalisation + resume maths for member watch progress — no I/O, no
 * `server-only`, so it's unit-testable in isolation. The server action
 * (lib/actions/contentProgress.ts) uses `normalizeProgressInput` to sanitise
 * whatever the player reports before it touches the private `content_progress`
 * table; the client player (components/content/VimeoWatch.tsx) uses
 * `resumeTarget` / `isEffectivelyComplete` to decide where to pick up and when
 * a watch counts as finished. Keeping both on the same shared, tested rules
 * means the "resume here" the client seeks to and the "completed" it records
 * never drift apart.
 */

/** int4 ceiling — `position_seconds`/`duration_seconds` are Postgres integers,
 *  so a bogus player value must never overflow the column. */
export const INT4_MAX = 2_147_483_647;

/** A watch this close to the end (or nearer) is treated as finished — we don't
 *  resume into the last few seconds, and we mark it complete. */
export const RESUME_END_GUARD_SECONDS = 8;

/** Don't bother resuming a trivial head-start; start from the top instead. */
export const RESUME_MIN_SECONDS = 5;

/** Fraction watched at/after which a watch counts as complete (so it drops off
 *  the "Pick up where you left off" shelf even if the player never fired end). */
export const COMPLETE_RATIO = 0.95;

/** Coerce any value to a safe, non-negative whole number of seconds within int4. */
export function clampSeconds(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 0;
  if (n < 0) return 0;
  if (n > INT4_MAX) return INT4_MAX;
  return n;
}

export interface RawProgressInput {
  contentItemId?: unknown;
  positionSeconds?: unknown;
  durationSeconds?: unknown;
  completed?: unknown;
}

export interface NormalizedProgress {
  contentItemId: string;
  positionSeconds: number;
  durationSeconds: number | null;
  completed: boolean;
}

/**
 * Sanitise a progress report into exactly the columns `content_progress` holds,
 * or null when it's unusable (no content id). The FK + RLS on the table are the
 * real guards; this just makes sure the numbers are sane and the shape is fixed.
 */
export function normalizeProgressInput(raw: RawProgressInput): NormalizedProgress | null {
  const contentItemId = typeof raw.contentItemId === "string" ? raw.contentItemId.trim() : "";
  if (!contentItemId) return null;

  const positionSeconds = clampSeconds(raw.positionSeconds);
  // 0 (or missing) duration is meaningless for the "N min left" label, so store null.
  const durationSeconds = raw.durationSeconds == null ? null : clampSeconds(raw.durationSeconds) || null;
  const completed = raw.completed === true;

  return { contentItemId, positionSeconds, durationSeconds, completed };
}

/**
 * Where to seek to on load, or null to start from the beginning. We skip a
 * trivial head-start (< RESUME_MIN_SECONDS), never resume a finished watch, and
 * never drop the member back into the final few seconds of a video.
 */
export function resumeTarget(
  positionSeconds: number,
  durationSeconds: number | null,
  completed: boolean
): number | null {
  if (completed) return null;
  if (!Number.isFinite(positionSeconds) || positionSeconds < RESUME_MIN_SECONDS) return null;
  if (durationSeconds != null && Number.isFinite(durationSeconds) && durationSeconds > 0) {
    if (positionSeconds >= durationSeconds - RESUME_END_GUARD_SECONDS) return null;
  }
  return Math.floor(positionSeconds);
}

/** True once enough of a video has been watched to count as finished. */
export function isEffectivelyComplete(positionSeconds: number, durationSeconds: number | null): boolean {
  if (durationSeconds == null || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return false;
  return positionSeconds / durationSeconds >= COMPLETE_RATIO;
}
