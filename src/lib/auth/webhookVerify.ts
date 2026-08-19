import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a Supabase Auth "Send Email" hook request. Supabase signs these with
 * the Standard Webhooks scheme (the same one Svix uses): the signed content is
 * `{id}.{timestamp}.{rawBody}`, HMAC-SHA256'd with the hook's symmetric secret,
 * base64-encoded, and sent in the `webhook-signature` header as a
 * space-separated list of `v1,<sig>` entries. The secret is provisioned on the
 * project and given to us as `v1,whsec_<base64>` (SUPABASE_AUTH_HOOK_SECRET).
 *
 * We verify the signature (constant-time) AND a timestamp tolerance, so a
 * replayed or forged request is rejected before we ever send an email. Same
 * node:crypto HMAC approach as verifyTwilioSignature / the guest-token signer.
 */

export type WebhookHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

const TOLERANCE_SECONDS = 5 * 60;

export function verifyStandardWebhook(
  rawBody: string,
  headers: WebhookHeaders,
  secret: string | undefined,
  nowSeconds: number
): boolean {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;

  // Reject stale/future timestamps (replay guard).
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) return false;

  // Secret arrives as "v1,whsec_<base64>"; the signing key is the base64-decoded
  // portion after the whsec_ prefix.
  const base64Secret = secret.replace(/^v1,/, "").replace(/^whsec_/, "");
  const keyBytes = Buffer.from(base64Secret, "base64");
  if (keyBytes.length === 0) return false;

  const expected = createHmac("sha256", keyBytes)
    .update(`${headers.id}.${headers.timestamp}.${rawBody}`)
    .digest("base64");

  // The header can carry several space-separated versioned signatures; a match
  // on any is sufficient.
  for (const part of headers.signature.split(" ")) {
    const sig = part.includes(",") ? part.slice(part.indexOf(",") + 1) : part;
    if (constantTimeEqual(sig, expected)) return true;
  }
  return false;
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
