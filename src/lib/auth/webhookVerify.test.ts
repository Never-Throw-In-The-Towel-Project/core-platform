import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";

// webhookVerify.ts starts with `import "server-only"` -- stub it (same as alert.test.ts).
vi.mock("server-only", () => ({}));

const { verifyStandardWebhook } = await import("./webhookVerify");

// A realistic secret ("v1,whsec_<base64>") and a helper that signs a body the
// way Supabase (Standard Webhooks) does, so we exercise the exact algorithm.
const SECRET = "v1,whsec_" + Buffer.from("super-secret-key-bytes").toString("base64");
const KEY = Buffer.from("super-secret-key-bytes");

function sign(id: string, ts: number, body: string): string {
  return "v1," + createHmac("sha256", KEY).update(`${id}.${ts}.${body}`).digest("base64");
}

describe("verifyStandardWebhook", () => {
  const id = "msg_123";
  const body = JSON.stringify({ user: { email: "a@b.test" }, email_data: { email_action_type: "magiclink" } });

  it("accepts a correctly signed, in-window request", () => {
    const now = 1_700_000_000;
    const headers = { id, timestamp: String(now), signature: sign(id, now, body) };
    expect(verifyStandardWebhook(body, headers, SECRET, now)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const now = 1_700_000_000;
    const headers = { id, timestamp: String(now), signature: sign(id, now, body) };
    expect(verifyStandardWebhook(body + "x", headers, SECRET, now)).toBe(false);
  });

  it("rejects a wrong signature", () => {
    const now = 1_700_000_000;
    const headers = { id, timestamp: String(now), signature: "v1,not-the-right-signature" };
    expect(verifyStandardWebhook(body, headers, SECRET, now)).toBe(false);
  });

  it("rejects a stale timestamp (replay guard)", () => {
    const signedAt = 1_700_000_000;
    const headers = { id, timestamp: String(signedAt), signature: sign(id, signedAt, body) };
    // 10 minutes later -> outside the 5-minute tolerance
    expect(verifyStandardWebhook(body, headers, SECRET, signedAt + 600)).toBe(false);
  });

  it("rejects when the secret is unset or headers are missing", () => {
    const now = 1_700_000_000;
    const headers = { id, timestamp: String(now), signature: sign(id, now, body) };
    expect(verifyStandardWebhook(body, headers, undefined, now)).toBe(false);
    expect(verifyStandardWebhook(body, { id: null, timestamp: String(now), signature: "x" }, SECRET, now)).toBe(false);
    expect(verifyStandardWebhook(body, { id, timestamp: null, signature: "x" }, SECRET, now)).toBe(false);
    expect(verifyStandardWebhook(body, { id, timestamp: String(now), signature: null }, SECRET, now)).toBe(false);
  });

  it("accepts a header carrying multiple space-separated signatures", () => {
    const now = 1_700_000_000;
    const good = sign(id, now, body);
    const headers = { id, timestamp: String(now), signature: `v1,other-sig ${good}` };
    expect(verifyStandardWebhook(body, headers, SECRET, now)).toBe(true);
  });
});
