import type { Metadata } from "next";
import { DraftNotice } from "@/components/legal/DraftNotice";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using Never Throw In The Towel.",
};

// DRAFT starter copy for NTITT's solicitor to review and replace. Not final,
// not legal advice.
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 text-lg font-bold tracking-tight">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-foreground/80">{children}</p>;
}

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <DraftNotice />
      <h1 className="text-3xl font-extrabold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted">Last updated: 14 August 2026</p>

      <H2>Agreement</H2>
      <P>
        These terms are between you and Never Throw In The Towel (&ldquo;NTITT&rdquo;). By creating an
        account or using the platform you agree to them. If you are using NTITT through your employer, some
        arrangements (such as who pays and which features are enabled) are governed by our agreement with
        them, but these terms still govern your personal use.
      </P>

      <H2>Eligibility and your account</H2>
      <P>
        You must be 16 or over to use the platform. Keep your login details secure and don&apos;t share your
        account. You&apos;re responsible for activity under your account. Tell us promptly if you think it has
        been compromised.
      </P>

      <H2>Not a medical service</H2>
      <P>
        NTITT supports wellbeing but is <strong>not a medical, crisis or emergency service</strong> and does
        not provide medical advice, diagnosis or treatment. Nothing here replaces professional care. If you
        are in crisis or someone is at risk, contact your GP, the Samaritans on 116 123, or the emergency
        services on 999. A crisis-support link is shown on every screen.
      </P>

      <H2>Acceptable use</H2>
      <P>
        Use the platform lawfully and respectfully. In the community, follow the Community Guidelines —
        don&apos;t harass, abuse, or post content that is unlawful, hateful or harmful. We may remove content
        and suspend accounts that break these rules.
      </P>

      <H2>Your content and privacy</H2>
      <P>
        Your private entries stay private to you, as described in the{" "}
        <a className="underline" href="/privacy">Privacy Policy</a>. You keep ownership of what you write; you
        grant us the limited licence needed to store and display it to you (and, for community posts, to the
        audience you post to).
      </P>

      <H2>Our content</H2>
      <P>
        The platform, its content and its branding belong to NTITT or its licensors and are protected by
        law. Don&apos;t copy, resell or redistribute it except as the platform allows.
      </P>

      <H2>Availability</H2>
      <P>
        We work to keep the platform available but don&apos;t guarantee it will be uninterrupted or
        error-free, and we may change or withdraw features.
      </P>

      <H2>Liability</H2>
      <P>
        To the extent permitted by law, NTITT is not liable for indirect or consequential loss. Nothing in
        these terms limits liability that cannot lawfully be limited (such as for death or personal injury
        caused by negligence). <em className="text-muted">(Final wording to be set with legal.)</em>
      </P>

      <H2>Ending your use</H2>
      <P>
        You can delete your account at any time from Settings. We may suspend or end access if these terms
        are broken or where we&apos;re required to.
      </P>

      <H2>Governing law</H2>
      <P>These terms are governed by the law of England and Wales.</P>

      <H2>Changes and contact</H2>
      <P>
        We may update these terms; the current version lives here. Questions:{" "}
        <a className="underline" href="mailto:hello@ntitt.co.uk">hello@ntitt.co.uk</a>.
      </P>
    </main>
  );
}
