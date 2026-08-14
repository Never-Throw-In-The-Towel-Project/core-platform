import type { Metadata } from "next";
import { DraftNotice } from "@/components/legal/DraftNotice";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Never Throw In The Towel handles your personal data.",
};

// DRAFT starter copy for NTITT's solicitor to review and replace. Written to
// cover the UK GDPR essentials for a health-adjacent wellbeing product; the
// facts (data categories, processors, retention, contact) are drawn from the
// codebase's actual behaviour, but the wording is not final and not legal advice.
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 text-lg font-bold tracking-tight">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-foreground/80">{children}</p>;
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <DraftNotice />
      <h1 className="text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">Last updated: 14 August 2026</p>

      <H2>Who we are</H2>
      <P>
        Never Throw In The Towel (&ldquo;NTITT&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) provides a
        wellbeing platform to members, usually through their employer. For the personal data described
        here, NTITT is the data controller. You can contact us about privacy at{" "}
        <a className="underline" href="mailto:privacy@ntitt.co.uk">privacy@ntitt.co.uk</a>.
      </P>

      <H2>The data we collect</H2>
      <P>
        <strong>Account data:</strong> your name or display name, email address, the company you belong
        to, and your notification preferences. <strong>Wellbeing data you choose to enter:</strong> your
        morning and night routines, weekly and 30/90-day reviews, sleep score and day rating, self-reported
        steps, and anything you write in the community. <strong>Technical data:</strong> a session cookie
        so you stay signed in, and, if you turn them on, a push-notification subscription.
      </P>

      <H2>How we use it, and what your employer can see</H2>
      <P>
        Your wellbeing entries are <strong>private to you</strong>. Your employer never sees the content of
        your routines, reviews, scores or journals. They see only <strong>aggregate participation numbers
        across their whole staff</strong> — for example how many people completed a check-in — and never an
        individual&apos;s answers, and never a total that could identify one person. We use your data to
        provide the service, send the reminders you ask for, and keep the platform safe.
      </P>

      <H2>Lawful bases</H2>
      <P>
        We rely on <strong>contract</strong> (to provide the service you or your employer signed up for),
        your <strong>consent</strong> (for optional things like notifications, community participation and
        the podcast), and our <strong>legitimate interests</strong> (to keep the service secure and
        working). Health-adjacent information you enter is treated as special-category data and handled with
        additional care; where required we rely on your explicit consent.
      </P>

      <H2>Who we share it with</H2>
      <P>
        We use trusted processors to run the service: <strong>Supabase</strong> (database and
        authentication), <strong>Brevo</strong> (transactional email), <strong>Twilio</strong> (support
        SMS, where enabled) and <strong>Vimeo</strong> (video hosting). They act on our instructions under
        data-processing terms. We do not sell your data. We may disclose data where the law requires it.
      </P>

      <H2>International transfers</H2>
      <P>
        Where a processor stores or handles data outside the UK, we rely on appropriate safeguards such as
        UK adequacy regulations or standard contractual clauses.{" "}
        <em className="text-muted">(To be confirmed against each processor&apos;s hosting region before launch.)</em>
      </P>

      <H2>How long we keep it</H2>
      <P>
        We keep your data for as long as your account is active. If you delete your account, your personal
        data is erased. Aggregate, non-identifying statistics may be retained.{" "}
        <em className="text-muted">(Specific retention periods to be set with legal.)</em>
      </P>

      <H2>Your rights</H2>
      <P>
        Under UK GDPR you have the right to access, correct, delete, restrict, object to, and receive a
        portable copy of your personal data, and to withdraw consent at any time. You can{" "}
        <strong>export your data</strong> and <strong>delete your account</strong> yourself from Settings,
        or contact us at{" "}
        <a className="underline" href="mailto:privacy@ntitt.co.uk">privacy@ntitt.co.uk</a>. You also have the
        right to complain to the Information Commissioner&apos;s Office (ico.org.uk).
      </P>

      <H2>Cookies</H2>
      <P>
        We use a small number of strictly-necessary cookies to keep you signed in. We do not use
        third-party advertising or analytics trackers.
      </P>

      <H2>Children</H2>
      <P>The platform is intended for adults and is not directed at children under 16.</P>

      <H2>Changes</H2>
      <P>
        We may update this policy; we will post the new version here and update the date above.
      </P>
    </main>
  );
}
