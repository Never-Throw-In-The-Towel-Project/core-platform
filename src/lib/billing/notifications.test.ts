import { describe, it, expect, vi } from "vitest";

// notifications.ts is server-only and imports the Brevo transport + the admin
// client at module load; mock them so we can unit-test the pure email builder and
// the thin send wrapper in isolation (no network, no supabase client).
vi.mock("server-only", () => ({}));
const sendBrandedEmail = vi.fn((): Promise<{ ok: boolean }> => Promise.resolve({ ok: true }));
vi.mock("@/lib/email/brevo", () => ({ sendBrandedEmail }));

type SentEmail = { to: string; subject: string; html: string; text: string };
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const { buildTrialEndingEmail, sendTrialEndingEmail, buildGrandfatherEmail } = await import("./notifications");

const URL_ = "https://app.neverthrowinthetowel.uk/settings";

describe("buildTrialEndingEmail", () => {
  it("says 'tomorrow' when a day or less is left", () => {
    const { subject, html, text } = buildTrialEndingEmail(1, URL_);
    expect(subject).toContain("tomorrow");
    expect(html).toContain("tomorrow");
    expect(text).toContain("tomorrow");
  });

  it("says 'in N days' for more than a day left", () => {
    const { subject, html } = buildTrialEndingEmail(2, URL_);
    expect(subject).toContain("in 2 days");
    expect(html).toContain("in 2 days");
    expect(subject).not.toContain("tomorrow");
  });

  it("embeds the settings URL as the call-to-action (html + plaintext)", () => {
    const { html, text } = buildTrialEndingEmail(2, URL_);
    expect(html).toContain(URL_);
    expect(text).toContain(URL_);
    expect(html).toContain("Keep my Pro access");
  });
});

describe("buildGrandfatherEmail", () => {
  it("reassures the member nothing changes and embeds the settings URL", () => {
    const { subject, html, text } = buildGrandfatherEmail(URL_);
    expect(subject).toContain("trial has started");
    expect(html).toContain("7 days");
    expect(html).toContain("See your plan");
    expect(html).toContain(URL_);
    expect(text).toContain(URL_);
  });
});

describe("sendTrialEndingEmail", () => {
  it("sends the built email to the recipient", async () => {
    sendBrandedEmail.mockClear();
    const res = await sendTrialEndingEmail("member@example.com", 1, URL_);
    expect(res.ok).toBe(true);
    expect(sendBrandedEmail).toHaveBeenCalledTimes(1);
    const arg = (sendBrandedEmail.mock.calls as unknown as SentEmail[][])[0][0];
    expect(arg.to).toBe("member@example.com");
    expect(arg.subject).toContain("tomorrow");
    expect(arg.html).toContain(URL_);
    expect(arg.text.length).toBeGreaterThan(0);
  });
});
