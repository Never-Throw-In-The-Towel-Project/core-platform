"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/what-i-do", label: "What I Do" },
  { href: "/documentary", label: "Documentary" },
  { href: "/podcast", label: "Podcast" },
];

/**
 * The marketing site's header. Below `lg`, the wordmark + full inline nav +
 * Sign in button don't fit on one row and wrap onto two lines mid-word --
 * so below that breakpoint the links collapse into a text toggle ("Menu" /
 * "Close") that opens a stacked panel instead, matching the rest of the
 * site's text-first, no-icon-library Modernist look rather than reaching
 * for a hamburger glyph.
 */
export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex shrink-0 items-center gap-2" onClick={() => setOpen(false)}>
          <Image src="/logo-mark.png" alt="Never Throw In The Towel" width={32} height={33} className="invert" />
          <span className="text-sm font-semibold tracking-wide whitespace-nowrap uppercase">
            Never Throw In The Towel
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm lg:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="whitespace-nowrap opacity-70 hover:opacity-100">
              {link.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="rounded-md bg-brand-accent px-5 py-2.5 font-semibold whitespace-nowrap text-brand-accent-foreground"
          >
            Sign in
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="marketing-mobile-nav"
          className="shrink-0 border border-black/15 px-4 py-2 text-xs font-semibold tracking-wide uppercase lg:hidden"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open && (
        <nav id="marketing-mobile-nav" className="border-t border-black/10 px-6 py-4 text-sm lg:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block border-b border-black/5 py-3 opacity-70 hover:opacity-100"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="mt-4 block rounded-md bg-brand-accent px-5 py-3 text-center font-semibold text-brand-accent-foreground"
          >
            Sign in
          </Link>
        </nav>
      )}
    </header>
  );
}
