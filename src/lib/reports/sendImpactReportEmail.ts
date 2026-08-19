import "server-only";
import { renderBrandedEmail } from "@/lib/email/layout";
import { sendBrandedEmail } from "@/lib/email/brevo";

export interface SendImpactReportEmailInput {
  toEmails: string[];
  companyName: string;
  pdfBuffer: Buffer;
  filename: string;
}

/**
 * Emails a company's 90-day wellbeing impact report (branded body + PDF
 * attachment) to its HR admins, through the shared layout + Brevo sender.
 * Returns { ok:false } when Brevo isn't configured or there are no recipients.
 */
export async function sendImpactReportEmail(
  input: SendImpactReportEmailInput
): Promise<{ ok: boolean; error?: string }> {
  if (input.toEmails.length === 0) return { ok: false, error: "no recipients" };

  const { html, text } = renderBrandedEmail({
    preheader: `${input.companyName}’s 90-day wellbeing impact report is attached.`,
    heading: "Your 90-day impact report",
    paragraphs: [
      `Attached is ${input.companyName}’s 90-day wellbeing programme impact report.`,
      "It’s aggregate, anonymised data only — no individual answers, names, or scores.",
    ],
    signoff: null,
  });

  const res = await sendBrandedEmail({
    to: input.toEmails.map((email) => ({ email })),
    subject: `Your 90-day NTITT wellbeing impact report — ${input.companyName}`,
    html,
    text,
    attachments: [{ name: input.filename, contentBase64: input.pdfBuffer.toString("base64") }],
  });
  return { ok: res.ok, error: res.error };
}
