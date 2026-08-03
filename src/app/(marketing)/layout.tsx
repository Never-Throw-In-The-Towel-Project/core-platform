import Link from "next/link";
import Image from "next/image";

/**
 * Shared nav for the public, no-signup-required marketing site -- home,
 * documentary, podcast, sign in. Everything paid/subscription content lives
 * behind /login (see docs/ARCHITECTURE.md); this is the free "taster" that
 * doesn't need one. Kept deliberately small: only real pages with real
 * content link here (no About/Events/Merchandise/Contact yet -- those need
 * source copy from Anthony before they're built, not invented copy).
 *
 * Light background here (bg-background/text-foreground), overriding the
 * root layout's dark bg-brand-background/text-brand-foreground default --
 * matches neverthrowinthetowel.com's actual look (predominantly white, with
 * strategic dark sections for emphasis, not all-dark). The logged-in app
 * ((app)/(admin) layouts) is untouched and stays dark; this override is
 * scoped to this route group only.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-black/10 bg-background px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo-mark.png" alt="Never Throw In The Towel" width={32} height={33} className="invert" />
          <span className="text-sm font-semibold tracking-wide uppercase">Never Throw In The Towel</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/documentary" className="opacity-70 hover:opacity-100">
            Documentary
          </Link>
          <Link href="/podcast" className="opacity-70 hover:opacity-100">
            Podcast
          </Link>
          <Link
            href="/login"
            className="rounded-md bg-brand-accent px-4 py-2 font-semibold text-brand-accent-foreground"
          >
            Sign in
          </Link>
        </nav>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
