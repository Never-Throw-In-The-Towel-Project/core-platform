import { describe, it, expect } from "vitest";
import { renderBrandedEmail } from "./layout";

describe("renderBrandedEmail", () => {
  it("renders heading, paragraphs, details and a button into the HTML + text", () => {
    const { html, text } = renderBrandedEmail({
      heading: "You’re almost booked in",
      paragraphs: ["Confirm your spot below."],
      details: [{ label: "When", value: "Sat 5 Sep" }],
      button: { label: "Confirm your spot", url: "https://x.test/confirm?t=abc" },
    });
    expect(html).toContain("You’re almost booked in");
    expect(html).toContain("Confirm your spot below.");
    expect(html).toContain("When");
    expect(html).toContain("Sat 5 Sep");
    expect(html).toContain('href="https://x.test/confirm?t=abc"');
    // text fallback carries the same content + the link as a bare URL
    expect(text).toContain("You’re almost booked in");
    expect(text).toContain("When: Sat 5 Sep");
    expect(text).toContain("Confirm your spot: https://x.test/confirm?t=abc");
  });

  it("escapes user-supplied content (no raw markup leaks into the HTML)", () => {
    const { html, text } = renderBrandedEmail({
      heading: "Hi <script>alert(1)</script>",
      paragraphs: ['A & B "quoted" <b>tag</b>'],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B");
    // plaintext keeps the raw characters (no HTML there to exploit)
    expect(text).toContain("<script>");
  });

  it("includes the branded wordmark header and footer tagline", () => {
    const { html, text } = renderBrandedEmail({ heading: "Hello" });
    expect(html).toContain("Never Throw In The Towel");
    expect(html).toContain("neverthrowinthetowel.uk");
    expect(text).toContain("neverthrowinthetowel.uk");
  });

  it("shows the hosted fist logomark in the header, keeping the wordmark as the image-off fallback", () => {
    const { html } = renderBrandedEmail({ heading: "Hello" });
    // absolute URL (email clients can't resolve relative paths)
    expect(html).toContain('src="https://neverthrowinthetowel.uk/email/logo-mark-email.png"');
    // decorative alt so a screen reader doesn't double-read the wordmark beside it
    expect(html).toContain('alt=""');
    // the text wordmark is still present, so a blocked image still brands the mail
    expect(html).toContain("Never Throw In The Towel");
  });

  it("defaults to a warm sign-off and can omit it", () => {
    const withSignoff = renderBrandedEmail({ heading: "Hi" });
    expect(withSignoff.text).toContain("Keep on living");
    const without = renderBrandedEmail({ heading: "Hi", signoff: null });
    expect(without.text).not.toContain("Keep on living");
  });

  it("renders a hidden preheader when provided", () => {
    const { html } = renderBrandedEmail({ heading: "Hi", preheader: "Preview me" });
    expect(html).toContain("Preview me");
    expect(html).toContain("display:none");
  });

  it("renders secondary links with an optional note", () => {
    const { html, text } = renderBrandedEmail({
      heading: "Hi",
      secondaryLinks: [{ note: "Changed your mind?", label: "Cancel any time", url: "https://x.test/cancel" }],
    });
    expect(html).toContain("Changed your mind?");
    expect(html).toContain('href="https://x.test/cancel"');
    expect(text).toContain("Cancel any time: https://x.test/cancel");
  });

  it("uses the AA-safe accent (#c81e0f) for the button, not the vivid decorative red", () => {
    const { html } = renderBrandedEmail({ heading: "Hi", button: { label: "Go", url: "https://x.test" } });
    expect(html).toContain("#c81e0f");
    // the vivid red only appears as the decorative header rule, never behind button text
    expect(html).not.toContain('bgcolor="#ec3013" style="padding');
  });
});
