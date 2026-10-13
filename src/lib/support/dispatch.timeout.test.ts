import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

const { dispatchSupportAlert } = await import("./alert");

// Finding E4: every outbound provider send must be time-bounded so a hung
// Twilio/Brevo socket can't wedge the "Ask for Support" submit that awaits this
// dispatch inline. We assert the security-relevant invariant directly: both the
// Twilio and Brevo fetches carry an AbortSignal (from AbortSignal.timeout).
describe("dispatchSupportAlert -- outbound sends are time-bounded (E4)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "ACxxxxxxxx");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "token");
    vi.stubEnv("TWILIO_FROM_NUMBER", "+10000000000");
    vi.stubEnv("BREVO_API_KEY", "brevo-key");
    vi.stubEnv("BREVO_SENDER_EMAIL", "no-reply@example.com");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.com");
    vi.stubEnv("SUPPORT_ACK_TOKEN_SECRET", "ack-secret");

    fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ sid: "SM123", messageId: "BRV123" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("passes an AbortSignal to BOTH the Twilio and Brevo fetches", async () => {
    await dispatchSupportAlert({
      requestId: "req-1",
      company: {
        name: "Acme",
        support_contact_name: "Pat",
        support_contact_phone: "+1222333444",
        support_contact_email: "pat@acme.co",
      },
      contactDisplayName: "Sam",
      urgency: "urgent",
      contactMethod: null,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const twilioCall = fetchMock.mock.calls.find(([url]) => String(url).includes("api.twilio.com"));
    const brevoCall = fetchMock.mock.calls.find(([url]) => String(url).includes("api.brevo.com"));

    expect(twilioCall, "Twilio fetch should have been made").toBeTruthy();
    expect(brevoCall, "Brevo fetch should have been made").toBeTruthy();

    for (const call of [twilioCall, brevoCall]) {
      const opts = call![1] as RequestInit;
      expect(opts.signal).toBeInstanceOf(AbortSignal);
    }
  });
});
