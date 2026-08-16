import Image from "next/image";
import { MEMBER_BENEFITS, PARTNER_LOGOS, TEXT_ONLY_CLIENTS, type Testimonial } from "./data";

/**
 * Shared, reusable pieces for the marketing home (default + partner variants),
 * all in the Modernist system (see globals.css): flat surfaces, hairline
 * borders, zero radius, a single red accent used strictly by role. Server
 * components throughout -- the only motion (the logo marquee) is pure CSS.
 */

/** Section kicker: an accent hairline + tiny wide-tracked uppercase label. */
export function Eyebrow({ children, onInk = false }: { children: React.ReactNode; onInk?: boolean }) {
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

/**
 * "What you get as a member" -- the login-gated value the old home never
 * showed. Reused verbatim by the default home and the tailored partner home;
 * the heading/intro are passed in so each can frame it for its audience.
 */
export function MemberBenefits({ heading, intro }: { heading: string; intro: string }) {
  return (
    <section className="border-t border-rule-hairline bg-background px-6 py-16 text-foreground sm:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="max-w-2xl">
          <Eyebrow>What you get</Eyebrow>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{heading}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted sm:text-base">{intro}</p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MEMBER_BENEFITS.map((benefit) => (
            <div key={benefit.name} className="flex flex-col border border-rule-border bg-background p-6">
              <span className="h-[3px] w-10 bg-brand-accent-vivid" aria-hidden />
              <p className="mt-4 text-lg font-extrabold tracking-tight">{benefit.name}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{benefit.blurb}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * The private-by-design promise -- a real, load-bearing product guarantee
 * (the Journey screen literally says "Only you can see this page. Not your
 * employer, not NTITT"; routine ratings are "private to you, never shared or
 * reported"). Especially important to staff on a company-skinned subdomain, so
 * `companyName` names their employer explicitly when provided.
 */
export function PrivacyNote({ companyName }: { companyName?: string | null }) {
  const who = companyName ?? "your employer";
  return (
    <section className="border-t border-rule-hairline bg-background px-6 pb-16 text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 border-l-2 border-brand-accent-vivid bg-background py-1 pl-5">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-accent-deep">
          Private by design
        </p>
        <p className="max-w-2xl text-sm leading-relaxed text-foreground/80">
          Your check-ins, ratings and Journey are private to you — never visible to {who}, never visible to NTITT.
          In a company step challenge only the team&apos;s combined total is ever shown, never an individual&apos;s.
        </p>
      </div>
    </section>
  );
}

/**
 * A single logo chip. A white tile with a hairline edge gives every supplied
 * logo (a mix of transparent and opaque marks) the same legible field.
 */
function LogoTile({ partner, duplicate = false }: { partner: (typeof PARTNER_LOGOS)[number]; duplicate?: boolean }) {
  return (
    <div
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

/**
 * The client-logo proof, for the employer band on the default home only. A
 * continuous marquee (the list rendered twice, translated -50% so the seam is
 * invisible), pausing on hover/focus and static under reduced motion. The
 * text-only clients follow as a small caption line.
 */
export function PartnerLogoStrip() {
  return (
    <div>
      <div className="overflow-hidden" aria-label="Organisations Anthony has worked with">
        <div className="animate-marquee flex w-max items-center gap-4">
          {PARTNER_LOGOS.map((partner) => (
            <LogoTile key={partner.src} partner={partner} />
          ))}
          {PARTNER_LOGOS.map((partner) => (
            <LogoTile key={`${partner.src}-dup`} partner={partner} duplicate />
          ))}
        </div>
      </div>
      {/* Reduced-motion fallback: a plain wrapped grid, no animation. */}
      <div className="mt-4 hidden max-w-4xl flex-wrap items-center gap-4 motion-reduce:flex">
        {PARTNER_LOGOS.map((partner) => (
          <LogoTile key={`${partner.src}-static`} partner={partner} />
        ))}
      </div>
      <p className="mt-6 text-sm text-muted-on-ink-2">
        …and Aldi, prisons, professional football clubs, {TEXT_ONLY_CLIENTS.join(", ")}.
      </p>
    </div>
  );
}

/**
 * A testimonial card: a flat bordered card led by an oversized accent quote
 * glyph, with the attribution set off below a hairline rule. Quotes are real,
 * supplied by Anthony (some end mid-sentence -- that's the source text).
 */
export function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <figure className="flex h-full flex-col border border-rule-border bg-background p-6 text-left">
      <span aria-hidden className="text-6xl font-black leading-[0.5] text-brand-accent-vivid">
        &ldquo;
      </span>
      <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-foreground/80">
        {testimonial.quote}
      </blockquote>
      <figcaption className="mt-6 border-t border-rule-hairline pt-4 text-xs font-extrabold uppercase tracking-wide text-brand-accent-deep">
        {testimonial.name}
      </figcaption>
    </figure>
  );
}

/**
 * Dormant on purpose. When the native iOS/Android apps ship, flip
 * SHOW_APP_DOWNLOAD to true (and drop real App Store / Google Play badge assets
 * into public/) to invite the optional download. Kept here, fully built, so the
 * only future change is the flag + the two badge images -- no layout rework.
 */
export const SHOW_APP_DOWNLOAD = false;

export function AppDownloadBand() {
  return (
    <section className="border-t border-rule-hairline bg-background px-6 py-14 text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <Eyebrow>Take it with you</Eyebrow>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight">Never Throw In The Towel, on your phone.</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Your daily routine, the community and your Journey — wherever you are.
          </p>
        </div>
        {/* Replace with real App Store / Google Play badge <Image>s when live. */}
        <div className="flex gap-3" aria-hidden>
          <span className="border border-rule-border px-5 py-3 text-xs font-extrabold uppercase tracking-wide text-muted">
            App Store
          </span>
          <span className="border border-rule-border px-5 py-3 text-xs font-extrabold uppercase tracking-wide text-muted">
            Google Play
          </span>
        </div>
      </div>
    </section>
  );
}
