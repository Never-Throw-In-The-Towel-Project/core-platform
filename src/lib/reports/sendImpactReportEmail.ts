import "server-only";

export interface SendImpactReportEmailInput {
  toEmails: string[];
  companyName: string;
  pdfBuffer: Buffer;
  filename: string;
}

export async function sendImpactReportEmail(
  input: SendImpactReportEmailInput
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;

  if (!apiKey || !senderEmail || input.toEmails.length === 0) {
    return { ok: false, error: "not configured" };
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: "NTITT Platform" },
        to: input.toEmails.map((email) => ({ email })),
        subject: `Your 90-day NTITT wellbeing impact report — ${input.companyName}`,
        textContent: `Attached is ${input.companyName}'s 90-day wellbeing programme impact report. Aggregate, anonymised data only -- no individual answers, names, or scores.`,
        attachment: [{ content: input.pdfBuffer.toString("base64"), name: input.filename }],
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return { ok: false, error: data?.message ?? `HTTP ${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
