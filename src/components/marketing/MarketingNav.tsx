"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/what-i-do", label: "What I Do" },
  { href: "/events", label: "Events" },
  { href: "/documentary", label: "Documentary" },
  { href: "/podcast", label: "Podcast" },
];

/**
 * The marketing site's header, in the Modernist design system (see
 * globals.css): flat, hairline-ruled, wide-tracked uppercase, zero radius.
 *
 * A thin **company skin strip** runs along the very top -- the same co-branding
 * motif the signed-in AppHeader uses. It takes the resolved company's
 * `primary_color` when this is a co-branded subdomain, and falls back to the
 * decorative NTITT red (--brand-accent-vivid) on the default site. Per the
 * design brief a company skin colours the strip only, never the accent, so this
 * is `primary_color` (the skin), not the accent token.
 *
 * Below `lg`, the wordmark + full inline nav + Sign in button don't fit on one
 * row, so the links collapse into a text toggle ("Menu" / "Close") that opens a
 * stacked panel -- matching the site's text-first, no-icon-library look rather
 * than reaching for a hamburger glyph.
 */
export function MarketingNav({ showSignup, skinColor }: { showSignup: boolean; skinColor?: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-rule-hairline bg-background">
      <div className="h-[3px] w-full" style={{ background: skinColor ?? "var(--brand-accent-vivid)" }} aria-hidden />
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex min-w-0 items-center gap-2" onClick={() => setOpen(false)}>
          {/* logo-mark.png is a light mark; inverted here to read on the light
              header (it shows as-is on the dark hero/app surfaces). */}
          <Image src="/logo-mark.png" alt="Never Throw In The Towel" width={32} height={33} className="shrink-0 invert" />
          {/* Truncates when space is tight (≤~375px phones) so the fixed logo +
              Menu button always fit; full wordmark shows from ~390px up. */}
          <span className="truncate text-sm font-extrabold tracking-wide uppercase">
            Never Throw In The Towel
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap font-semibold text-muted transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          {/* Individuals-first: on the default site "Create account" is the
              accent CTA and "Sign in" a quiet link. On a partner subdomain
              signup is invite-only (showSignup=false), so "Sign in" is the CTA
              and there's no create-account path. */}
          {showSignup ? (
            <>
              <Link
                href="/login"
                className="whitespace-nowrap font-semibold text-muted transition-colors hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="whitespace-nowrap bg-brand-accent px-5 py-2.5 text-xs font-extrabold uppercase tracking-wide text-brand-accent-foreground"
              >
                Create account
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="whitespace-nowrap bg-brand-accent px-5 py-2.5 text-xs font-extrabold uppercase tracking-wide text-brand-accent-foreground"
            >
              Sign in
            </Link>
          )}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="marketing-mobile-nav"
          className="shrink-0 border border-rule-border px-4 py-2 text-xs font-extrabold tracking-wide uppercase lg:hidden"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open && (
        <nav id="marketing-mobile-nav" className="border-t border-rule-hairline px-6 py-4 text-sm lg:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block border-b border-rule-hairline py-3 font-semibold text-muted transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          {showSignup ? (
            <>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block border-b border-rule-hairline py-3 font-semibold text-muted transition-colors hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="mt-4 block bg-brand-accent px-5 py-3 text-center text-xs font-extrabold uppercase tracking-wide text-brand-accent-foreground"
              >
                Create account
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="mt-4 block bg-brand-accent px-5 py-3 text-center text-xs font-extrabold uppercase tracking-wide text-brand-accent-foreground"
            >
              Sign in
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
