import "server-only";
import { renderBrandedEmail } from "@/lib/email/layout";
import { sendBrandedEmail } from "@/lib/email/brevo";

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
 * Rendered through the shared branded layout; no-ops (returns false) when Brevo
 * isn't configured, so the cron never throws.
 */
export async function sendTargetHitEmail(input: TargetHitEmailInput): Promise<boolean> {
  const { html, text } = renderBrandedEmail({
    preheader: `${input.companyName}’s team reached the step target.`,
    heading: "Your team hit the target 🎉",
    paragraphs: [
      `Great news — the team at ${input.companyName} reached the target for “${input.title}”.`,
    ],
    details: [
      { label: "Steps", value: `${input.totalSteps.toLocaleString()} of ${input.targetSteps.toLocaleString()}` },
      { label: "Challenge", value: input.title },
    ],
    afterButton: [
      "The reward is now unlocked — it’s administered by your company.",
      "Aggregate figure only. No individual step counts are ever shared.",
    ],
    signoff: null,
  });

  const res = await sendBrandedEmail({
    to: input.to,
    subject: `Step challenge target reached — ${input.companyName}`,
    html,
    text,
  });
  return res.ok;
}
