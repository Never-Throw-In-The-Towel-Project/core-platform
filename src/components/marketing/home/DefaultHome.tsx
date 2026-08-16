import Image from "next/image";
import Link from "next/link";
import {
  CONTACT_MAILTO,
  STORY_PARAGRAPHS,
  TESTIMONIALS,
  WORKPLACE_SERVICES,
} from "./data";
import {
  AppDownloadBand,
  Eyebrow,
  MemberBenefits,
  PartnerLogoStrip,
  PrivacyNote,
  SHOW_APP_DOWNLOAD,
  TestimonialCard,
} from "./shared";

/**
 * The default marketing home (neverthrowinthetowel.uk / app.*), rebuilt
 * individuals-first: it sells the login-gated platform and a "Create account"
 * action, gives employers their own clearly-signposted lane, and keeps
 * Anthony's story + documentary + podcast as supporting proof rather than the
 * headline. The tailored, company-skinned variant lives in PartnerHome.
 */
export function DefaultHome() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      {/* Reserved for the native apps -- dormant until they ship (SHOW_APP_DOWNLOAD). */}
      {SHOW_APP_DOWNLOAD && <AppDownloadBand />}
      <MemberBenefits
        heading="Everything to help you keep going."
        intro="Once you're in, you're not doing it alone — a daily routine, a community that gets it, and tools for whatever life throws your way."
      />
      <PrivacyNote />
      <ForWorkplace />
      <ProofAndStory />
      <ClosingCta />
    </main>
  );
}

/* ---- Hero (ink, individuals-first) ---------------------------------------- */
function Hero() {
  return (
    <section className="bg-brand-background text-brand-foreground">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div className="flex flex-col">
          <Image src="/logo-mark.png" alt="Never Throw In The Towel" width={64} height={66} preload />
          <h1 className="mt-6 text-[40px] font-extrabold leading-[0.95] tracking-tight uppercase sm:text-6xl">
            Keep going — together.
          </h1>
          <p className="mt-4 text-sm font-extrabold uppercase tracking-[0.3em] text-brand-accent-light-2">
            Keep on Living
          </p>
          <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-muted-on-ink-2 sm:text-base">
            A members&apos; community and simple daily tools — built on lived experience — to help you talk, move, and
            keep going, no matter what life throws your way.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href="/signup"
              className="inline-flex w-full items-center justify-center bg-brand-foreground px-7 py-3.5 text-sm font-extrabold uppercase tracking-wide text-brand-background transition-colors hover:bg-brand-accent hover:text-brand-accent-foreground sm:w-auto"
            >
              Create your account
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center border border-muted-on-ink-2 px-7 py-3.5 text-sm font-extrabold uppercase tracking-wide text-brand-foreground transition-colors hover:border-brand-accent-light hover:text-brand-accent-light sm:w-auto"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-5 text-sm text-muted-on-ink-2">
            Booking for your workplace?{" "}
            <a href="#for-workplaces" className="font-semibold text-brand-accent-light underline underline-offset-4">
              See what we do for employers →
            </a>
          </p>
        </div>

        {/* LCP element -> preload hint (this Next deprecates `priority`). */}
        <div className="relative aspect-square w-full overflow-hidden sm:aspect-[3/2] lg:aspect-square">
          <Image
            src="/site/hero-boxing.jpg"
            alt=""
            fill
            sizes="(min-width: 1024px) 42vw, 100vw"
            className="site-photo object-cover object-top"
            preload
          />
        </div>
      </div>
    </section>
  );
}

/* ---- For your workplace (ink band, employer lane) ------------------------- */
function ForWorkplace() {
  return (
    <section id="for-workplaces" className="bg-brand-background px-6 py-16 text-brand-foreground sm:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="max-w-2xl">
          <Eyebrow onInk>For workplaces</Eyebrow>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Bring real conversations into your workplace.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-on-ink-2 sm:text-base">
            From the pop-up barbershop to keynotes and a company-wide wellbeing platform, we help employers open up
            honest conversations about mental health — especially in male-dominated industries.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {WORKPLACE_SERVICES.map((service) => (
            <div key={service.title} className="flex flex-col border border-ink-hairline p-6">
              <span className="h-[3px] w-10 bg-brand-accent-vivid" aria-hidden />
              <p className="mt-4 text-lg font-extrabold tracking-tight text-brand-foreground">{service.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-on-ink-2">{service.blurb}</p>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-muted-on-ink">
            Trusted by teams at
          </p>
          <div className="mt-4">
            <PartnerLogoStrip />
          </div>
        </div>

        <div className="mt-10">
          <a
            href={CONTACT_MAILTO}
            className="inline-flex items-center justify-center bg-brand-accent px-7 py-3.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground transition-colors hover:bg-brand-accent-light-2"
          >
            Book Anthony / enquire
          </a>
        </div>
      </div>
    </section>
  );
}

/* ---- Proof & story (paper, supporting) ------------------------------------ */
function ProofAndStory() {
  return (
    <section className="border-t border-rule-hairline bg-background px-6 py-16 text-foreground sm:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-1 items-start gap-10 md:grid-cols-2 md:gap-14">
          <div>
            <Eyebrow>The story</Eyebrow>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Why it exists.</h2>
            <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-muted">
              {STORY_PARAGRAPHS.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <Link
                href="/documentary"
                className="text-sm font-extrabold uppercase tracking-wide text-brand-accent-deep underline-offset-4 hover:underline"
              >
                Watch the documentary →
              </Link>
              <Link
                href="/podcast"
                className="text-sm font-extrabold uppercase tracking-wide text-brand-accent-deep underline-offset-4 hover:underline"
              >
                Listen to the podcast →
              </Link>
            </div>
          </div>
          <div className="relative aspect-[4/5] w-full border-2 border-foreground">
            <Image
              src="/site/founder-speaking.jpg"
              alt="Anthony Hutton speaking on Never Throw In The Towel"
              fill
              sizes="(min-width: 768px) 40vw, 100vw"
              className="site-photo object-cover object-top"
            />
          </div>
        </div>

        <div className="mt-14">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-muted">What people say</p>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            {TESTIMONIALS.map((testimonial) => (
              <TestimonialCard key={testimonial.name} testimonial={testimonial} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---- Closing CTA (ink) ---------------------------------------------------- */
function ClosingCta() {
  return (
    <section className="bg-brand-background px-6 py-16 text-center text-brand-foreground sm:py-20">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Ready to keep going?</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-on-ink-2 sm:text-base">
          Join a community that has your back, and tools you can use every single day.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="inline-flex w-full items-center justify-center bg-brand-foreground px-7 py-3.5 text-sm font-extrabold uppercase tracking-wide text-brand-background transition-colors hover:bg-brand-accent hover:text-brand-accent-foreground sm:w-auto"
          >
            Create your account
          </Link>
          <a
            href={CONTACT_MAILTO}
            className="inline-flex w-full items-center justify-center border border-muted-on-ink-2 px-7 py-3.5 text-sm font-extrabold uppercase tracking-wide text-brand-foreground transition-colors hover:border-brand-accent-light hover:text-brand-accent-light sm:w-auto"
          >
            For your workplace? Enquire
          </a>
        </div>
      </div>
    </section>
  );
}
