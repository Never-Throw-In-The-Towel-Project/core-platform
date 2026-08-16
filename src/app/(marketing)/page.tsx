import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { resolveCompanyForHost } from "@/lib/tenant/resolve";

// "Trusted by" strip -- partner/client logos supplied by Anthony (NTITT
// Logos/ at repo root).
const PARTNER_LOGOS = [
  { src: "/partners/aldi.png", name: "ALDI Australia" },
  { src: "/partners/amazon.png", name: "Amazon" },
  { src: "/partners/barbour.png", name: "Barbour" },
  { src: "/partners/kp-snacks.png", name: "KP Snacks" },
  { src: "/partners/loreal.png", name: "L'Oréal" },
  { src: "/partners/lighthouse-charity.png", name: "Lighthouse Charity" },
  { src: "/partners/the-hill-group.png", name: "The Hill Group" },
  { src: "/partners/vanlove.png", name: "Vanlove" },
];

// Real copy from neverthrowinthetowel.com, ported over verbatim (Anthony's
// own already-published words, not invented for this rebuild) -- see the
// conversation this shipped from for the source screenshots. Kept as one
// story rather than split into multiple pages today: About/Events/
// Merchandise/Contact all need source copy from Anthony first, so those
// stay off the nav (src/app/(marketing)/layout.tsx) until that exists,
// rather than inventing content for them. This redesign restyles that copy
// into the Modernist system (see globals.css) without changing a word.
const ABOUT_PARAGRAPHS = [
  `"Never Throw in the Towel" is a boxing term that means never giving up and continuing to fight. This talk explores the power and simplicity of that mindset, which can save lives and provide support when dealing with depression and mental health challenges. I know this to be true from my own lived experience.`,
  `I created a project called "Never Throw in the Towel" with the strapline "Keep on Living." These were the words I used at the end of my grandmother's eulogy when she passed away. Her legacy inspired me to start this project.`,
  `I share my personal story of struggles after overnight fame from winning the reality TV show Big Brother. This sudden fame brought extreme highs and lows, leading me into a very dark headspace and depression. Although I felt a lot of shame during that time, I am now proud of my resilience and determination to never give up.`,
  `I discuss my role as a barber, where I regularly engage with men who open up while sitting in the chair. This experience inspired me to bring my barber chair to companies in a comfortable and natural environment for men to talk without pressure. This approach is particularly effective for men in male-dominated industries like construction and manufacturing. While the talk focuses on men's mental health and suicide, it is designed for everyone, and attendees can benefit.`,
  `I discuss suicide statistics and explore strategies to address this issue and improve mental health. The main message is that "talking is a strength, not a weakness." One key takeaway from the talk is inspired by Napoleon Hill: "in every adversity, every failure, every heartache carries with it the seed of an equal or greater benefit."`,
];

type Testimonial = { quote: string; name: string };

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "As a parent and mental health advocate, nothing could have prepared me for the heart-wrenching moment when I learned my child was experiencing thoughts of self-harm. Being neurodiverse, my quiet, sensitive child…",
    name: "A Mother's Testimonial",
  },
  {
    quote:
      "I engaged Anthony Hutton to deliver a motivational speech to an English Football League club. It was remarkable. To fully engage a squad of professional athletes, fresh off the training ground…",
    name: "UK Independent Medical and Optus Law",
  },
  {
    quote:
      "The Never Throw in the Towel Project focuses on an incredibly important topic that we all need to think more about, and Anthony is a brilliant advocate for improving men's mental health. The talk…",
    name: "Newcastle United — Conference",
  },
];

type Offering = { title: string; blurb: string; image: string; href?: string };

// Each offering reuses one of the 5 real event/founder photos supplied by
// Anthony (public/site/*.jpg) -- matches neverthrowinthetowel.com's actual
// pattern of a real photo atop every card, not text-only tiles. A couple of
// images repeat across cards/sections since there are only 5 real photos
// for 7 slots on this page -- acceptable, real sites do this too. Every photo
// is graded via the shared .site-photo treatment.
const OFFERINGS: Offering[] = [
  {
    title: "Pop Up Barbershop",
    blurb: "Men need a safe space to talk with no pressure or stigma -- the pop up barbershop does exactly that.",
    image: "/site/community-brotherhood.jpg",
    href: "/what-i-do/pop-up-barbershop",
  },
  {
    title: "The Never Throw in the Towel Podcast",
    blurb: "Each episode, we sit down with guests who've faced real challenges.",
    image: "/site/podcast-recording.jpg",
    href: "/podcast",
  },
  {
    title: "Free Monthly Meet-Ups in Nature",
    blurb: "Every month, we bring people together outdoors for something simple but incredibly powerful: connection.",
    image: "/site/community-group.jpg",
  },
  {
    title: "The Thrive Project",
    blurb: "Walk, talk, breathe, and reset with Anthony -- a full day in nature tailored to you.",
    image: "/site/hero-boxing.jpg",
    href: "/what-i-do/coaching",
  },
  {
    title: "Keynote Speaking",
    blurb: "Anthony also delivers standalone keynotes, fully tailored to suit your timescale and audience.",
    image: "/site/founder-speaking.jpg",
    href: "/documentary",
  },
];

const STAND_FOR_POINTS = ["Let's keep talking", "Let's keep showing up", "Let's keep doing the work"];

/**
 * Small red eyebrow label -- the Modernist system's section kicker: an accent
 * hairline followed by tiny, wide-tracked uppercase text. Uses the role-correct
 * red for its ground: --brand-accent-deep on the light paper (6.5:1) and
 * --brand-accent-light-2 on the ink band (5.3:1). The leading rule is the
 * decorative --brand-accent-vivid, which never sits under text so the AA
 * text-contrast rule doesn't apply to it.
 */
function Eyebrow({ children, onInk = false }: { children: React.ReactNode; onInk?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px w-8 shrink-0 bg-brand-accent-vivid" aria-hidden />
      <span
        className={`text-[11px] font-extrabold uppercase tracking-[0.22em] ${
          onInk ? "text-brand-accent-light-2" : "text-brand-accent-deep"
        }`}
      >
        {children}
      </span>
    </div>
  );
}

function LogoTile({ partner, duplicate = false }: { partner: (typeof PARTNER_LOGOS)[number]; duplicate?: boolean }) {
  return (
    <div
      // A white chip behind every logo: the supplied logos are a mix of
      // transparent-on-dark and opaque marks, so on the light paper ground the
      // light ones would otherwise vanish. A flat white tile with a hairline
      // edge (no radius, no shadow -- Modernist) gives every logo the same
      // legible field.
      className="flex h-16 w-32 shrink-0 items-center justify-center border border-rule-hairline bg-white p-3"
      aria-hidden={duplicate}
    >
      <Image
        src={partner.src}
        alt={partner.name}
        width={104}
        height={40}
        style={{ width: "auto", height: "auto", maxWidth: "100%", maxHeight: "100%" }}
      />
    </div>
  );
}

function OfferingCard({ offering }: { offering: Offering }) {
  return (
    <article className="flex w-full flex-col border-2 border-foreground bg-background sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)]">
      <div className="relative aspect-[16/10] w-full overflow-hidden border-b-2 border-foreground">
        <Image
          src={offering.image}
          alt=""
          fill
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
          className="site-photo object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="text-lg font-extrabold leading-tight tracking-tight">{offering.title}</h3>
        <p className="text-sm leading-relaxed text-muted">{offering.blurb}</p>
        {offering.href && (
          <Link
            href={offering.href}
            className="mt-auto pt-3 text-[13px] font-extrabold uppercase tracking-wide text-brand-accent-deep underline-offset-4 hover:underline"
          >
            Learn more →
          </Link>
        )}
      </div>
    </article>
  );
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    // Paper cards on the ink testimonials band -- the inverse-ground contrast
    // is the section's whole visual idea. A 3px vivid top strip echoes the
    // redesign's accent-edge motif (the same 3px active border on nav/week
    // cells); stars use --brand-accent-deep, the AA-safe red text on paper.
    <figure className="flex flex-col bg-background text-foreground">
      <span className="h-[3px] w-full bg-brand-accent-vivid" aria-hidden />
      <div className="flex flex-1 flex-col gap-4 p-6 text-left">
        <blockquote className="text-sm leading-relaxed">{testimonial.quote}</blockquote>
        <figcaption className="mt-auto">
          <p className="text-sm font-extrabold">{testimonial.name}</p>
          <p className="mt-0.5 tracking-widest text-brand-accent-deep" aria-label="5 out of 5 stars">
            ★★★★★
          </p>
        </figcaption>
      </div>
    </figure>
  );
}

function CheckItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      {/* "✓" is text sitting ON the accent fill, so this uses the AA-safe
          --brand-accent (not the vivid decorative red) with its paired
          foreground token. */}
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-accent text-xs font-bold text-brand-accent-foreground">
        ✓
      </span>
      <span className="text-sm">{label}</span>
    </div>
  );
}

// Public landing page -- the free "taster" of a platform whose actual
// content (daily routines, community, the video library) is subscription-
// gated behind /login. This page's job is to convince someone that's worth
// signing up for, built entirely around Anthony's own lived experience and
// process for overcoming/prioritising men's mental health.
//
// Rebuilt to the Modernist design system introduced with the Today redesign
// (see docs / globals.css): a light ink-on-paper ground, a single red accent
// used strictly by role, full-colour photography, flat surfaces with zero corner
// radius, 2px ink borders and wide-tracked uppercase eyebrows. Ink bands
// (bg-brand-background) are reserved for the emphasis moments -- the hero, the
// testimonials, and the closing podcast call -- with the prose and card
// sections on paper between them, so the page reads as the same product as the
// signed-in app. Copy is unchanged from the previous version; only the design
// is new.
export default async function MarketingHomePage() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const company = await resolveCompanyForHost(host);

  const primaryHeadline = company ? `${company.name} × Never Throw In The Towel` : "Never Throw In The Towel Project";
  const heroCopy =
    company?.welcome_copy ??
    "A movement built on resilience, lived experience, and the power of community. From barber chairs to cold water therapy — we're helping people keep going, no matter what life throws their way.";

  return (
    <main className="flex flex-1 flex-col">
      {/* ---- Hero (ink band, photography-led split) ---- */}
      <section className="bg-brand-background text-brand-foreground">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div className="flex flex-col">
            <div className="flex items-center gap-4">
              {/* logo-mark.png is a light mark -- shown as-is on the ink band
                  (the nav inverts it for the light header). */}
              <Image src="/logo-mark.png" alt="Never Throw In The Towel" width={64} height={66} preload />
              {company?.logo_url && (
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

            <h1 className="mt-6 text-[40px] font-extrabold leading-[0.95] tracking-tight uppercase sm:text-6xl">
              {primaryHeadline}
            </h1>

            {!company && (
              <p className="mt-4 text-sm font-extrabold uppercase tracking-[0.3em] text-brand-accent-light-2">
                Keep on Living
              </p>
            )}

            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-muted-on-ink-2 sm:text-base">{heroCopy}</p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center bg-brand-foreground px-7 py-3.5 text-sm font-extrabold uppercase tracking-wide text-brand-background transition-colors hover:bg-brand-accent hover:text-brand-accent-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/documentary"
                className="inline-flex items-center justify-center border border-muted-on-ink-2 px-7 py-3.5 text-sm font-extrabold uppercase tracking-wide text-brand-foreground transition-colors hover:border-brand-accent-light hover:text-brand-accent-light"
              >
                Watch the Documentary
              </Link>
            </div>
          </div>

          {/* Framed hero photograph -- the LCP element, so it carries
              the `preload` hint (this Next deprecates `priority` in favour of
              `preload`; see node_modules/next/dist/docs .../image.md). */}
          <div className="relative aspect-[4/5] w-full border border-ink-hairline sm:aspect-[3/2] lg:aspect-[4/5]">
            <Image
              src="/site/hero-boxing.jpg"
              alt=""
              fill
              sizes="(min-width: 1024px) 42vw, 100vw"
              className="site-photo object-cover"
              preload
            />
          </div>
        </div>
      </section>

      {/* ---- Partner "trusted by" strip (default page only) ----
          A company's own co-branded portal shouldn't show a generic partner
          wall. */}
      {!company && (
        <section className="border-t border-rule-hairline bg-background py-12 text-center text-foreground">
          <div className="px-6">
            <div className="inline-flex">
              <Eyebrow>Companies we&apos;ve worked with</Eyebrow>
            </div>
          </div>

          {/* Motion-safe: the continuous marquee (the list rendered twice back
              to back so the -50% loop seam is invisible), paused on hover/focus. */}
          <div
            className="mx-auto mt-8 max-w-4xl overflow-hidden motion-reduce:hidden"
            style={{
              maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
              WebkitMaskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
            }}
          >
            <div className="animate-marquee flex w-max items-center gap-4">
              {PARTNER_LOGOS.map((partner) => (
                <LogoTile key={partner.src} partner={partner} />
              ))}
              {PARTNER_LOGOS.map((partner) => (
                <LogoTile key={`${partner.src}-dup`} partner={partner} duplicate />
              ))}
            </div>
          </div>

          {/* Reduced motion: a static wrapped grid instead. The animated strip
              lives inside overflow-hidden, so with the animation disabled it
              would permanently clip every logo past the first row -- this
              variant shows them all, wrapped and centred, with nothing hidden. */}
          <div className="mx-auto mt-8 hidden max-w-4xl flex-wrap items-center justify-center gap-4 px-6 motion-reduce:flex">
            {PARTNER_LOGOS.map((partner) => (
              <LogoTile key={`${partner.src}-static`} partner={partner} />
            ))}
          </div>
        </section>
      )}

      {/* ---- About the Project (paper, prose + portrait) ---- */}
      <section className="border-t border-rule-hairline bg-background px-6 py-16 text-foreground sm:py-20">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-start gap-10 md:grid-cols-2 md:gap-14">
          <div>
            <Eyebrow>About the project</Eyebrow>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">About the Project</h2>
            <div className="mt-4 h-1 w-16 bg-brand-accent-vivid" />
            <div className="mt-6 space-y-4 text-sm leading-relaxed">
              {ABOUT_PARAGRAPHS.map((paragraph) => (
                <p key={paragraph.slice(0, 24)}>{paragraph}</p>
              ))}
            </div>
          </div>
          <div className="relative aspect-[4/5] w-full border-2 border-foreground md:sticky md:top-24">
            <Image
              src="/site/founder-speaking.jpg"
              alt="Anthony Hutton speaking on Never Throw In The Towel"
              fill
              sizes="(min-width: 768px) 45vw, 100vw"
              className="site-photo object-cover"
            />
          </div>
        </div>
      </section>

      {/* ---- Offerings (paper, flat bordered cards) ---- */}
      <section className="border-t border-rule-hairline bg-background px-6 py-16 text-foreground sm:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl">
            <Eyebrow>What we do</Eyebrow>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Real Spaces. Real Stories. Real Support.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Not everyone wants to talk — and that&apos;s okay. We&apos;ve created different ways for people to
              connect, reset, and open up in a way that feels natural.
            </p>
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {OFFERINGS.map((offering) => (
              <OfferingCard key={offering.title} offering={offering} />
            ))}
          </div>
        </div>
      </section>

      {/* ---- Testimonials (ink band, paper cards) ---- */}
      <section id="testimonials" className="bg-brand-background px-6 py-16 text-brand-foreground sm:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl">
            <Eyebrow onInk>What people say</Eyebrow>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">What People Are Saying</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-on-ink-2">
              From global brands to local communities, Anthony&apos;s work has left a lasting impact. Here&apos;s how
              his talks, coaching, and retreats have inspired change, built trust, and opened up life-changing
              conversations.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {TESTIMONIALS.map((testimonial) => (
              <TestimonialCard key={testimonial.name} testimonial={testimonial} />
            ))}
          </div>
        </div>
      </section>

      {/* ---- What we stand for (paper, prose + checklist + photo) ---- */}
      <section className="border-t border-rule-hairline bg-background px-6 py-16 text-foreground sm:py-20">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-14">
          <div>
            <Eyebrow>What we stand for</Eyebrow>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">This is What We Stand For</h2>
            <div className="mt-4 h-1 w-16 bg-brand-accent-vivid" />
            <div className="mt-6 space-y-4 text-sm leading-relaxed">
              <p>At the core of Never Throw in the Towel is a simple message: keep going.</p>
              <p>Life can be heavy. But we&apos;re not meant to carry it alone.</p>
              <p>
                Whether you join us for a free monthly meet-up, become part of The Thrive Project community, or book
                a one-to-one day in nature — know this:
              </p>
              <p>You&apos;ll be supported. You&apos;ll be heard. And you&apos;ll be reminded that you&apos;re not alone.</p>
            </div>
            <div className="mt-6 flex flex-col gap-3">
              {STAND_FOR_POINTS.map((point) => (
                <CheckItem key={point} label={point} />
              ))}
            </div>
          </div>
          <div className="relative aspect-[4/5] w-full border-2 border-foreground">
            <Image
              src="/site/community-group.jpg"
              alt=""
              fill
              sizes="(min-width: 768px) 45vw, 100vw"
              className="site-photo object-cover"
            />
          </div>
        </div>
      </section>

      {/* ---- Podcast (ink band, closing call) -- default page only ---- */}
      {!company && (
        <section className="bg-brand-background px-6 py-16 text-brand-foreground sm:py-20">
          <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-14">
            <div>
              <Eyebrow onInk>The podcast</Eyebrow>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">The Podcast</h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-on-ink-2">
                Real conversations with guests who&apos;ve faced real challenges — recorded raw, no scripts, no
                polish. New episodes every month.
              </p>
              <Link
                href="/podcast"
                className="mt-8 inline-flex items-center justify-center bg-brand-foreground px-7 py-3.5 text-sm font-extrabold uppercase tracking-wide text-brand-background transition-colors hover:bg-brand-accent hover:text-brand-accent-foreground"
              >
                Hear the stories
              </Link>
            </div>
            <div className="relative aspect-video w-full border border-ink-hairline">
              <Image
                src="/site/podcast-recording.jpg"
                alt="Recording the Never Throw In The Towel podcast"
                fill
                sizes="(min-width: 768px) 45vw, 100vw"
                className="site-photo object-cover"
              />
            </div>
          </div>
        </section>
      )}

      {/* Closing copyright line. Deliberately a <div>, not a <footer>: the
          marketing layout already renders the page's <footer> landmark (the
          always-visible crisis-support entry point), and two footer landmarks
          would be ambiguous for assistive tech. */}
      <div className="border-t border-rule-hairline bg-background px-6 py-8 text-center text-xs text-muted">
        <p className="font-extrabold uppercase tracking-wide text-foreground">Never Throw In The Towel — Keep On Living</p>
        <p className="mt-2">© {new Date().getFullYear()} Never Throw In The Towel Project. All rights reserved.</p>
      </div>
    </main>
  );
}
