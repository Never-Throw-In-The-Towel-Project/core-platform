import { renderBrandedEmail } from "@/lib/email/layout";

/**
 * The branded content for each Supabase Auth email, rendered through the ONE
 * shared layout (src/lib/email/layout.ts) so the sign-in / invite / confirm /
 * recovery / email-change mails match every other NTITT email exactly. Pure and
 * unit-tested; the send-email hook route wraps this with signature verification
 * and the Brevo send.
 *
 * `reauthentication` is the one flow that emails a CODE rather than a link
 * (Supabase's secure-action nonce); the rest carry a single action button to
 * our /auth/confirm route.
 */

export type AuthEmailActionType =
  | "signup"
  | "magiclink"
  | "invite"
  | "recovery"
  | "email_change"
  | "reauthentication";

type Spec = {
  subject: string;
  preheader: string;
  heading: string;
  paragraphs: string[];
  button: string;
  afterButton?: string[];
};

const SPECS: Record<Exclude<AuthEmailActionType, "reauthentication">, Spec> = {
  signup: {
    subject: "Confirm your account",
    preheader: "Confirm your email to finish setting up your account.",
    heading: "Confirm your account",
    paragraphs: ["Confirm your email address to finish setting up your Never Throw In The Towel account."],
    button: "Confirm my account",
    afterButton: ["If you didn’t create an account, you can safely ignore this email."],
  },
  magiclink: {
    subject: "Your sign-in link",
    preheader: "Your one-time sign-in link for Never Throw In The Towel.",
    heading: "Your sign-in link",
    paragraphs: ["Use the button below to sign in. This link can only be used once and expires shortly."],
    button: "Sign in",
    afterButton: [
      "If you didn’t ask to sign in, you can safely ignore this email — no one can access your account from it alone.",
    ],
  },
  invite: {
    subject: "You’re invited to Never Throw In The Towel",
    preheader: "You’ve been invited to Never Throw In The Towel.",
    heading: "You’re invited",
    paragraphs: ["You’ve been invited to join Never Throw In The Towel. Set up your account below to get started."],
    button: "Accept your invite",
  },
  recovery: {
    subject: "Reset your password",
    preheader: "Reset your Never Throw In The Towel password.",
    heading: "Reset your password",
    paragraphs: ["We got a request to reset your password. Use the button below — it expires shortly."],
    button: "Reset password",
    afterButton: ["Didn’t ask for this? You can ignore this email; your password won’t change."],
  },
  email_change: {
    subject: "Confirm your new email address",
    preheader: "Confirm your new email address for Never Throw In The Towel.",
    heading: "Confirm your new email address",
    paragraphs: ["Confirm this is your new email address for Never Throw In The Towel."],
    button: "Confirm new email",
  },
};

export function buildAuthEmail(input: {
  actionType: string;
  actionUrl: string;
  token?: string;
}): { subject: string; html: string; text: string } {
  if (input.actionType === "reauthentication") {
    const code = input.token?.trim() || "";
    const { html, text } = renderBrandedEmail({
      preheader: "Your verification code.",
      heading: "Your verification code",
      paragraphs: ["Enter this code to confirm it’s you. It expires shortly.", code],
      signoff: null,
    });
    return { subject: "Your verification code", html, text };
  }

  // Unknown/unexpected action types fall back to the safe magic-link shape.
  const spec = SPECS[(input.actionType as keyof typeof SPECS) in SPECS ? (input.actionType as keyof typeof SPECS) : "magiclink"];
  const { html, text } = renderBrandedEmail({
    preheader: spec.preheader,
    heading: spec.heading,
    paragraphs: spec.paragraphs,
    button: { label: spec.button, url: input.actionUrl },
    showButtonUrl: true,
    afterButton: spec.afterButton,
    signoff: null,
  });
  return { subject: spec.subject, html, text };
}
