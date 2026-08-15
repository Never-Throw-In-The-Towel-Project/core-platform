import { describe, it, expect } from "vitest";
import { summarizeConfig } from "./config";

// A fully-provisioned env, so individual tests can knock out one var at a time.
const FULL_ENV: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  NEXT_PUBLIC_SITE_URL: "https://app.example",
  CRON_SECRET: "cron",
  BREVO_API_KEY: "brevo",
  BREVO_SENDER_EMAIL: "hello@ntitt.co.uk",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "vapub",
  VAPID_PRIVATE_KEY: "vapriv",
  VAPID_SUBJECT: "mailto:ops@ntitt.co.uk",
  SUPPORT_ACK_TOKEN_SECRET: "ack",
  NTITT_FALLBACK_CONTACT_EMAIL: "fallback@ntitt.co.uk",
  TWILIO_ACCOUNT_SID: "sid",
  TWILIO_AUTH_TOKEN: "tok",
  TWILIO_FROM_NUMBER: "+441234567890",
  ANTHROPIC_API_KEY: "sk-ant",
};

const group = (summary: ReturnType<typeof summarizeConfig>, key: string) =>
  summary.groups.find((g) => g.key === key)!;

describe("summarizeConfig", () => {
  it("reports criticalOk and every group configured for a full env", () => {
    const summary = summarizeConfig(FULL_ENV);
    expect(summary.criticalOk).toBe(true);
    expect(summary.groups.every((g) => g.configured)).toBe(true);
    expect(summary.groups.flatMap((g) => g.missing)).toEqual([]);
  });

  it("flags a missing critical var by name and fails criticalOk", () => {
    const { CRON_SECRET, ...env } = FULL_ENV;
    void CRON_SECRET;
    const summary = summarizeConfig(env);
    expect(summary.criticalOk).toBe(false);
    const cron = group(summary, "cron");
    expect(cron.configured).toBe(false);
    expect(cron.missing).toEqual(["CRON_SECRET"]);
  });

  it("treats a blank/whitespace value as unset", () => {
    const summary = summarizeConfig({ ...FULL_ENV, BREVO_API_KEY: "   " });
    expect(group(summary, "email").missing).toEqual(["BREVO_API_KEY"]);
    expect(summary.criticalOk).toBe(false);
  });

  it("lists every missing var in a partially-configured group", () => {
    const summary = summarizeConfig({ ...FULL_ENV, VAPID_PRIVATE_KEY: "", VAPID_SUBJECT: "" });
    expect(group(summary, "push").missing).toEqual(["VAPID_PRIVATE_KEY", "VAPID_SUBJECT"]);
  });

  it("does not fail criticalOk when only a non-critical group is missing", () => {
    const { ANTHROPIC_API_KEY, TWILIO_AUTH_TOKEN, ...env } = FULL_ENV;
    void ANTHROPIC_API_KEY;
    void TWILIO_AUTH_TOKEN;
    const summary = summarizeConfig(env);
    expect(summary.criticalOk).toBe(true);
    expect(group(summary, "ai").configured).toBe(false);
    expect(group(summary, "sms").configured).toBe(false);
  });

  it("never leaks values — only var names appear in `missing`", () => {
    const summary = summarizeConfig({});
    const allMissing = summary.groups.flatMap((g) => g.missing);
    // Every reported name is an env var KEY (UPPER_SNAKE), not a secret value.
    expect(allMissing.every((name) => /^[A-Z0-9_]+$/.test(name))).toBe(true);
    expect(summary.criticalOk).toBe(false);
  });
});
