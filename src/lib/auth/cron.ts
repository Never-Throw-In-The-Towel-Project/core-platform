import "server-only";

/**
 * Shared auth check for the Vercel Cron routes
 * (src/app/api/jobs/*). Replaces the inline
 * `authHeader !== \`Bearer ${process.env.CRON_SECRET}\`` each route used to
 * do, with two hardening fixes found in the full-platform security review:
 *
 *  1. Fail CLOSED when CRON_SECRET is unset. The old inline check compared
 *     against the literal string "Bearer undefined" whenever the env var was
 *     missing -- so a misconfigured deploy accepted
 *     `Authorization: Bearer undefined` from anyone. These jobs re-aggregate
 *     every user's private data, fire escalation SMS/email, and email 90-day
 *     impact reports; none may ever run for an unauthenticated caller, and a
 *     missing secret must deny, not accidentally allow.
 *  2. Constant-time comparison, so the secret can't be recovered
 *     byte-by-byte from response timing -- the same reasoning behind the
 *     Twilio signature and ack-token checks in src/lib/support/alert.ts.
 *
 * Accepts a plain `Request` so it works for both `NextRequest` (which
 * extends it) and any future non-Next caller.
 */
export async function verifyCronRequest(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed on misconfiguration

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const { timingSafeEqual } = await import("node:crypto");
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authHeader);
  // timingSafeEqual throws on unequal lengths; a length check first is not a
  // meaningful leak (the "Bearer " prefix and token length aren't the
  // secret being guessed).
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
