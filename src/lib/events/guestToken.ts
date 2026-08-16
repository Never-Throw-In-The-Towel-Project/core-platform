import "server-only";

/**
 * HMAC token for a guest event booking's confirm/cancel links -- the same
 * low-stakes, forge-proof signature scheme as the Ask-for-Support ack link
 * (src/lib/support/alert.ts generateAckToken). It signs the booking id, so
 * possession of the token authorises confirming or cancelling THAT booking and
 * nothing else. Not a full auth system: the guest has no account, and the link
 * is only ever emailed to the address that made the booking.
 *
 * Requires EVENT_BOOKING_TOKEN_SECRET. When unset, signing returns null and
 * verification fails closed -- guest booking simply can't be completed rather
 * than issuing spoofable links.
 */
export async function signBookingToken(bookingId: string): Promise<string | null> {
  const secret = process.env.EVENT_BOOKING_TOKEN_SECRET;
  if (!secret) return null;
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", secret).update(bookingId).digest("hex");
}

export async function verifyBookingToken(bookingId: string, token: string): Promise<boolean> {
  const expected = await signBookingToken(bookingId);
  if (expected === null) return false;
  const { timingSafeEqual } = await import("node:crypto");
  // timingSafeEqual throws on length mismatch; a length check first isn't a
  // meaningful timing leak (both are fixed-length hex digests). Same guard as
  // the Twilio/ack signature checks.
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
