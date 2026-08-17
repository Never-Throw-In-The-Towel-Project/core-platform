import "server-only";

// Challenge notification emails via Brevo (same transport as the 90-day impact
// report and the support alert -- fetch, no SDK). Both senders degrade silently
// to a no-op when unconfigured, so a missing key never throws into a server
// action or a cron job.
async function sendBrevoEmail(to: string, subject: string, textContent: string): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail || !to) return false;
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { email: senderEmail, name: "NTITT Platform" },
        to: [{ email: to }],
        subject,
        textContent,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface TargetHitEmailInput {
  to: string;
  companyName: string;
  title: string;
  totalSteps: number;
  targetSteps: number;
}

/**
 * Notify an HR admin that their team hit the challenge target (brief §2's
 * developer flag). Aggregate figure only -- never an individual step count.
 */
export async function sendTargetHitEmail(input: TargetHitEmailInput): Promise<boolean> {
  const text =
    `Great news — your team hit the target for "${input.title}": ` +
    `${input.totalSteps.toLocaleString()} of ${input.targetSteps.toLocaleString()} steps. ` +
    `The reward is now unlocked; it's administered by your company. ` +
    `(Aggregate figure only — no individual step counts.)`;
  return sendBrevoEmail(input.to, `Step challenge target reached — ${input.companyName}`, text);
}
