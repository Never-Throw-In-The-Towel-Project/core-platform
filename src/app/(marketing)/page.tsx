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
// rather than inventing content for them.
const ABOUT_PARAGRAPHS = [
  `"Never Throw in the Towel" is a boxing term that means never giving up and continuing to fight. This talk explores the power and simplicity of that mindset, which can save lives and provide support when dealing with depression and mental health challenges. I know this to be true from my own lived experience.`,
  `I created a project called "Never Throw in the Towel" with the strapline "Keep on Living." These were the words I used at the end of my grandmother's eulogy when she passed away. Her legacy inspired me to start this project.`,
  `I share my personal story of struggles after overnight fame from winning the reality TV show Big Brother. This sudden fame brought extreme highs and lows, leading me into a very dark headspace and depression. Although I felt a lot of shame during that time, I am now proud of my resilience and determination to never give up.`,
  `I discuss my role as a barber, where I regularly engage with men who open up while sitting in the chair. This experience inspired me to bring my barber chair to companies in a comfortable and natural environment for men to talk without pressure. This approach is particularly effective for men in male-dominated industries like construction and manufacturing. While the talk focuses on men's mental health and suicide, it is designed for everyone, and attendees can benefit.`,
  `I discuss suicide statistics and explore strategies to address this issue and improve mental health. The main message is that "talking is a strength, not a weakness." One key takeaway from the talk is inspired by Napoleon Hill: "in every adversity, every failure, every heartache carries with it the seed of an equal or greater benefit."`,
];

const TESTIMONIALS = [
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

// Each offering reuses one of the 5 real event/founder photos supplied by
// Anthony (public/site/*.jpg) -- matches neverthrowinthetowel.com's actual
// pattern of a real photo atop every card, not text-only tiles. A couple of
// images repeat across cards/sections since there are only 5 real photos
// for 7 slots on this page -- acceptable, real sites do this too.
const OFFERINGS = [
  {
    title: "Pop Up Barbershop",
    blurb: "Men need a safe space to talk with no pressure or stigma -- the pop up barbershop does exactly that.",
    image: "/site/community-brotherhood.jpg",
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
  },
  {
    title: "Keynote Speaking",
    blurb: "Anthony also delivers standalone keynotes, fully tailored to suit your timescale and audience.",
    image: "/site/founder-speaking.jpg",
    href: "/documentary",
  },
];

const STAND_FOR_POINTS = ["Let's keep talking", "Let's keep showing up", "Let's keep doing the work"];

function CheckBadge() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-accent text-[10px] font-bold text-brand-accent-foreground">
      ✓
    </span>
  );
}

// Public landing page -- the free "taster" of a platform whose actual
// content (daily routines, community, the video library) is subscription-
// gated behind /login. This page's job is to convince someone that's worth
// signing up for, built entirely around Anthony's own lived experience and
// process for overcoming/prioritising men's mental health, and guests'
// first-hand experience on specific topics -- not a generic wellness pitch.
//
// Section backgrounds deliberately alternate light/dark (bg-background vs
// bg-brand-background), matching neverthrowinthetowel.com's actual layout
// -- see (marketing)/layout.tsx's comment for why this page can safely
// invert the app's usual all-dark default.
export default async function MarketingHomePage() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const company = await resolveCompanyForHost(host);

  return (
    <main className="flex flex-1 flex-col">
      <section className="bg-brand-background px-6 py-20 text-center text-brand-foreground">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6">
          <div className="flex items-center gap-4">
            <Image src="/logo-mark.png" alt="Never Throw In The Towel" width={96} height={98} preload />
            {company?.logo_url && (
              <>
                <span className="text-2xl opacity-40">×</span>
                <div className="flex h-16 w-28 items-center justify-center rounded-md bg-white p-3">
                  <Image
                    src={company.logo_url}
                    alt={company.name}
                    width={96}
                    height={40}
                    style={{ width: "auto", height: "auto", maxWidth: "100%", maxHeight: "100%" }}
                  />
                </div>
              </>
            )}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight uppercase sm:text-5xl">
            {company ? `${company.name} × Never Throw In The Towel` : "Never Throw In The Towel Project"}
          </h1>
          {!company && <p className="text-xl tracking-[0.3em] uppercase opacity-90">Keep on Living</p>}
          <p className="max-w-md text-brand-foreground/80">
            {company?.welcome_copy ??
              "A movement built on resilience, lived experience, and the power of community. From barber chairs to cold water therapy — we're helping people keep going, no matter what life throws their way."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="rounded-md bg-brand-accent px-6 py-3 font-semibold text-brand-accent-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/documentary"
              className="rounded-md border border-white/30 px-6 py-3 font-semibold opacity-90 hover:opacity-100"
            >
              Watch the Documentary
            </Link>
          </div>
        </div>
      </section>

      {/* Only on the default (non-branded) marketing page -- a company's
          own co-branded portal shouldn't show a generic partner wall. */}
      {!company && (
        <section className="bg-background px-6 py-16 text-center text-foreground">
          <h2 className="text-xl font-bold">Companies we&apos;ve worked with</h2>
          <div className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-4">
            {PARTNER_LOGOS.map((partner) => (
              <div
                key={partner.src}
                className="flex h-16 w-32 items-center justify-center rounded-md border border-black/10 p-3"
              >
                <Image
                  src={partner.src}
                  alt={partner.name}
                  width={104}
                  height={40}
                  style={{ width: "auto", height: "auto", maxWidth: "100%", maxHeight: "100%" }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-background px-6 py-16 text-foreground">
        <div className="mx-auto grid max-w-4xl grid-cols-1 items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold">About the Project</h2>
            <div className="mt-3 h-1 w-16 bg-brand-accent" />
            <div className="mt-6 space-y-4 text-sm leading-relaxed text-foreground/80">
              {ABOUT_PARAGRAPHS.map((paragraph) => (
                <p key={paragraph.slice(0, 24)}>{paragraph}</p>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-xl">
            <Image
              src="/site/founder-speaking.jpg"
              alt="Anthony Hutton speaking on Never Throw In The Towel"
              width={1200}
              height={1486}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      <section className="bg-brand-background px-6 py-16 text-brand-foreground">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold">What People Are Saying</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-brand-foreground/70">
            From global brands to local communities, Anthony&apos;s work has left a lasting impact. Here&apos;s how
            his talks, coaching, and retreats have inspired change, built trust, and opened up life-changing
            conversations.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {TESTIMONIALS.map((testimonial) => (
              <div key={testimonial.name} className="flex flex-col gap-3 rounded-lg bg-background p-5 text-left text-foreground">
                <p className="text-sm text-foreground/80">{testimonial.quote}</p>
                <div>
                  <p className="text-sm font-semibold">{testimonial.name}</p>
                  <p className="text-brand-accent" aria-label="5 out of 5 stars">
                    ★★★★★
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background px-6 py-16 text-foreground">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold">Real Spaces. Real Stories. Real Support.</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-foreground/70">
            Not everyone wants to talk — and that&apos;s okay. We&apos;ve created different ways for people to
            connect, reset, and open up in a way that feels natural.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {OFFERINGS.map((offering) => (
              <div key={offering.title} className="flex flex-col overflow-hidden rounded-xl border border-black/10 text-left">
                <div className="aspect-video w-full overflow-hidden">
                  <Image
                    src={offering.image}
                    alt={offering.title}
                    width={800}
                    height={450}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <p className="font-semibold">{offering.title}</p>
                  <p className="text-sm text-foreground/70">{offering.blurb}</p>
                  {offering.href && (
                    <Link href={offering.href} className="mt-auto text-sm font-medium text-brand-accent underline">
                      Learn More
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-brand-background px-6 py-16 text-brand-foreground">
        <div className="mx-auto grid max-w-4xl grid-cols-1 items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold">This is What We Stand For</h2>
            <div className="mt-6 space-y-3 text-sm text-brand-foreground/80">
              <p>At the core of Never Throw in the Towel is a simple message: keep going.</p>
              <p>Life can be heavy. But we&apos;re not meant to carry it alone.</p>
              <p>
                Whether you join us for a free monthly meet-up, become part of The Thrive Project community, or book
                a one-to-one day in nature — know this:
              </p>
              <p>
                You&apos;ll be supported. You&apos;ll be heard. And you&apos;ll be reminded that you&apos;re not
                alone.
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-3 text-sm">
              {STAND_FOR_POINTS.map((point) => (
                <div key={point} className="flex items-center gap-2">
                  <CheckBadge />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-xl">
            <Image
              src="/site/hero-boxing.jpg"
              alt="Never Throw In The Towel"
              width={953}
              height={1326}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      {!company && (
        <section className="bg-background px-6 py-16 text-center text-foreground">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl font-bold">The Podcast</h2>
            <div className="mt-8 overflow-hidden rounded-xl">
              <Image
                src="/site/podcast-recording.jpg"
                alt="Recording the Never Throw In The Towel podcast"
                width={1024}
                height={576}
                className="h-full w-full object-cover"
              />
            </div>
            <Link
              href="/podcast"
              className="mt-8 inline-block rounded-md bg-brand-accent px-6 py-3 font-semibold text-brand-accent-foreground"
            >
              Hear the stories
            </Link>
          </div>
        </section>
      )}

      <footer className="border-t border-black/10 bg-background px-6 py-8 text-center text-xs text-foreground/60">
        <p className="font-semibold tracking-wide uppercase">Never Throw In The Towel — Keep On Living</p>
        <p className="mt-2">© {new Date().getFullYear()} Never Throw In The Towel Project. All rights reserved.</p>
      </footer>
    </main>
  );
}
