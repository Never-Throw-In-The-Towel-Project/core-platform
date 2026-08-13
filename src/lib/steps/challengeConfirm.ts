import "server-only";

// HMAC-signed confirmation token for the Anthony-visit reward. Mirrors the
// support "ack" link pattern (src/lib/support/alert.ts): an unauthenticated but
// UNFORGEABLE link Anthony taps to confirm availability and make the challenge
// live -- there's no login flow for him. Reuses SUPPORT_ACK_TOKEN_SECRET with a
// namespaced message so a token minted for one purpose can never be replayed for
// the other (a support-ack token is HMAC(secret, requestId); this is
// HMAC(secret, "challenge-confirm:" + challengeId)).
const MESSAGE_PREFIX = "challenge-confirm:";

export async function generateChallengeConfirmToken(challengeId: string): Promise<string | null> {
  const secret = process.env.SUPPORT_ACK_TOKEN_SECRET;
  if (!secret) return null;
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", secret).update(MESSAGE_PREFIX + challengeId).digest("hex");
}

export async function verifyChallengeConfirmToken(challengeId: string, token: string): Promise<boolean> {
  const expected = await generateChallengeConfirmToken(challengeId);
  if (expected === null || !token) return false;
  const { timingSafeEqual } = await import("node:crypto");
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  // Length check ahead of timingSafeEqual (which throws on mismatched lengths);
  // both are fixed-length hex digests, so length is public, not a secret.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function buildChallengeConfirmUrl(challengeId: string): Promise<string | null> {
  const token = await generateChallengeConfirmToken(challengeId);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!token || !siteUrl) return null;
  const url = new URL(`/api/challenges/${challengeId}/confirm`, siteUrl);
  url.searchParams.set("token", token);
  return url.toString();
}
