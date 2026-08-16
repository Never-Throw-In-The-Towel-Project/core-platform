import Image from "next/image";
import Link from "next/link";
import type { Company } from "@/types/database";
import { MemberBenefits, PrivacyNote } from "./shared";

/**
 * The tailored home shown on a partner co-branded subdomain (kp-snacks.*,
 * amazon.*) -- i.e. whenever `resolveCompanyForHost` returns a company. Its one
 * job is to get that employer's staff into the platform, so it drops the sales
 * pitch and the "companies we've worked with" proof entirely and leads with the
 * privacy promise (staff worry their employer can see their data).
 *
 * Self-service signup is invite-only on partner subdomains (see
 * src/lib/actions/signup.ts + src/app/signup/page.tsx), so the only action here
 * is Sign in -- there is deliberately no "Create account".
 */
export function PartnerHome({ company }: { company: Company }) {
  const welcome =
    company.welcome_copy ??
    "Your wellbeing space, in partnership with Never Throw In The Towel — daily tools and a community to help you keep going, no matter what life throws your way.";

  return (
    <main className="flex flex-1 flex-col">
      {/* ---- Hero (ink) ---- */}
      <section className="bg-brand-background text-brand-foreground">
        <div className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
          <div className="flex items-center gap-4">
            <Image src="/logo-mark.png" alt="Never Throw In The Towel" width={56} height={58} preload />
            {company.logo_url && (
              <>
                <span className="text-2xl text-muted-on-ink" aria-hidden>
                  ×
                </span>
                <span className="flex h-14 w-28 items-center justify-center bg-white p-3">
                  <Image
                    src={company.logo_url}
                    alt={company.name}
                    width={96}
                    height={40}
                    style={{ width: "auto", height: "auto", maxWidth: "100%", maxHeight: "100%" }}
                  />
                </span>
              </>
            )}
          </div>

          <h1 className="mt-8 text-[36px] font-extrabold leading-[1.02] tracking-tight sm:text-5xl">
            Welcome, {company.name} team.
          </h1>
          <p className="mt-3 text-sm font-extrabold uppercase tracking-[0.3em] text-brand-accent-light-2">
            Keep on Living
          </p>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-muted-on-ink-2 sm:text-base">{welcome}</p>

          <div className="mt-8">
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center bg-brand-foreground px-7 py-3.5 text-sm font-extrabold uppercase tracking-wide text-brand-background transition-colors hover:bg-brand-accent hover:text-brand-accent-foreground sm:w-auto"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-5 max-w-xl text-sm text-muted-on-ink-2">
            Access is provided by {company.name}. Use the invite from your workplace to get started.
          </p>
        </div>
      </section>

      {/* Privacy first -- the thing staff most need to hear. */}
      <PrivacyNote companyName={company.name} />

      <MemberBenefits
        heading="Your wellbeing space, ready when you are."
        intro={`Everything below is included with your ${company.name} membership — private to you, and there whenever you need it.`}
      />

      {/* ---- Who's behind it (compact, supporting) ---- */}
      <section className="border-t border-rule-hairline bg-background px-6 py-14 text-foreground">
        <div className="mx-auto flex max-w-5xl flex-col gap-3">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-accent-deep">
            Who&apos;s behind it
          </p>
          <p className="max-w-2xl text-[15px] leading-relaxed text-muted">
            Never Throw In The Towel was founded by Anthony Hutton and is built on lived experience — a movement to
            help people keep going, from barber chairs to cold-water therapy.
          </p>
          <Link
            href="/documentary"
            className="mt-1 text-sm font-extrabold uppercase tracking-wide text-brand-accent-deep underline-offset-4 hover:underline"
          >
            Watch the documentary →
          </Link>
        </div>
      </section>

      {/* ---- Closing sign-in CTA (ink) ---- */}
      <section className="bg-brand-background px-6 py-16 text-center text-brand-foreground sm:py-20">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Ready when you are.</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-on-ink-2 sm:text-base">
            Sign in with the invite from {company.name} and pick up where you left off.
          </p>
          <div className="mt-8">
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center bg-brand-foreground px-7 py-3.5 text-sm font-extrabold uppercase tracking-wide text-brand-background transition-colors hover:bg-brand-accent hover:text-brand-accent-foreground sm:w-auto"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
