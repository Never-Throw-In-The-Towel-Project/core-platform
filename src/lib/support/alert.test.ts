import { afterEach, describe, expect, it, vi } from "vitest";
import { generateAckToken, verifyAckToken, verifyTwilioSignature } from "./alert";

// alert.ts starts with `import "server-only"` -- see the matching comment
// in aggregates.test.ts for why this needs stubbing before import.
vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("generateAckToken / verifyAckToken", () => {
  it("returns null when SUPPORT_ACK_TOKEN_SECRET is not configured", async () => {
    vi.stubEnv("SUPPORT_ACK_TOKEN_SECRET", undefined);
    expect(await generateAckToken("req-1")).toBeNull();
  });

  it("generates a stable, deterministic token for the same request id and secret", async () => {
    vi.stubEnv("SUPPORT_ACK_TOKEN_SECRET", "test-secret");
    const first = await generateAckToken("req-1");
    const second = await generateAckToken("req-1");
    expect(first).not.toBeNull();
    expect(first).toBe(second);
  });

  it("generates a different token for a different request id", async () => {
    vi.stubEnv("SUPPORT_ACK_TOKEN_SECRET", "test-secret");
    const tokenA = await generateAckToken("req-1");
    const tokenB = await generateAckToken("req-2");
    expect(tokenA).not.toBe(tokenB);
  });

  it("verifies a correctly generated token", async () => {
    vi.stubEnv("SUPPORT_ACK_TOKEN_SECRET", "test-secret");
    const token = await generateAckToken("req-1");
    expect(await verifyAckToken("req-1", token!)).toBe(true);
  });

  it("rejects a tampered or unrelated token", async () => {
    vi.stubEnv("SUPPORT_ACK_TOKEN_SECRET", "test-secret");
    const token = await generateAckToken("req-1");
    expect(await verifyAckToken("req-1", `${token}extra`)).toBe(false);
    expect(await verifyAckToken("req-1", "not-the-right-token-at-all")).toBe(false);
  });

  it("rejects a token generated for a different request id", async () => {
    vi.stubEnv("SUPPORT_ACK_TOKEN_SECRET", "test-secret");
    const tokenForOtherRequest = await generateAckToken("req-2");
    expect(await verifyAckToken("req-1", tokenForOtherRequest!)).toBe(false);
  });

  it("returns false when the secret is unset even if a token is supplied", async () => {
    vi.stubEnv("SUPPORT_ACK_TOKEN_SECRET", undefined);
    expect(await verifyAckToken("req-1", "anything")).toBe(false);
  });
});

describe("verifyTwilioSignature", () => {
  const url = "https://core-platform-psi.vercel.app/api/webhooks/twilio-status";
  const params: Record<string, string> = { MessageSid: "SM123", MessageStatus: "delivered" };

  it("returns false when there is no signature header", async () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", "test-token");
    expect(await verifyTwilioSignature(url, params, null)).toBe(false);
  });

  it("returns false when TWILIO_AUTH_TOKEN is not configured", async () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", undefined);
    expect(await verifyTwilioSignature(url, params, "some-signature")).toBe(false);
  });

  it("accepts a correctly computed signature and rejects a wrong one", async () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", "test-token");
    const { createHmac } = await import("node:crypto");
    const sortedKeys = Object.keys(params).sort();
    const data = sortedKeys.reduce((acc, key) => acc + key + params[key], url);
    const validSignature = createHmac("sha1", "test-token").update(data, "utf8").digest("base64");

    expect(await verifyTwilioSignature(url, params, validSignature)).toBe(true);
    expect(await verifyTwilioSignature(url, params, "wrong-signature")).toBe(false);
  });
});
