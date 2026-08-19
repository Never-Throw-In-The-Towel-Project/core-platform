import { describe, it, expect } from "vitest";
import { buildAuthEmail } from "./authEmailContent";

const URL = "https://neverthrowinthetowel.uk/auth/confirm?token_hash=abc&type=magiclink";

describe("buildAuthEmail", () => {
  it("renders each link-based action with its own subject + the action button", () => {
    const cases: Record<string, RegExp> = {
      signup: /Confirm your account/,
      magiclink: /sign-in link/i,
      invite: /invited/i,
      recovery: /Reset your password/,
      email_change: /new email/i,
    };
    for (const [type, subjectRe] of Object.entries(cases)) {
      const { subject, html, text } = buildAuthEmail({ actionType: type, actionUrl: URL });
      expect(subject).toMatch(subjectRe);
      // HTML escapes & in the URL (&amp;); the token_hash prefix is enough to
      // confirm the action link is wired into the button + fallback.
      expect(html).toContain("/auth/confirm?token_hash=abc");
      expect(text).toContain(URL); // plaintext keeps the raw URL
      expect(html).toContain("Never Throw In The Towel"); // shared branded layout
    }
  });

  it("falls back to the magic-link shape for an unknown action type", () => {
    const { subject } = buildAuthEmail({ actionType: "totally_unknown", actionUrl: URL });
    expect(subject).toMatch(/sign-in link/i);
  });

  it("renders reauthentication as a code, not a link", () => {
    const { subject, html, text } = buildAuthEmail({ actionType: "reauthentication", actionUrl: "", token: "123456" });
    expect(subject).toMatch(/verification code/i);
    expect(html).toContain("123456");
    expect(text).toContain("123456");
  });
});
